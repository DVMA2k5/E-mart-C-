using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class InvoiceService
{
    private readonly AppDbContext _db;
    public InvoiceService(AppDbContext db) => _db = db;

    // Idempotent: one immutable monetary/customer/item snapshot per order.
    public async Task<Invoice?> EnsureInvoiceForOrderAsync(int orderId)
    {
        var existing = await _db.Invoices.Include(i => i.Items).FirstOrDefaultAsync(i => i.OrderId == orderId);
        if (existing != null) return existing;
        var order = await _db.Orders.Include(o => o.Customer).Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null || order.Status == "cancelled" || !(order.Status is "processing" or "completed" || order.PaymentStatus == "paid")) return null;

        var now = DateTime.UtcNow;
        var invoice = new Invoice { OrderId = order.Id, InvoiceNumber = "HD-" + order.OrderNumber,
            InvoiceStatus = "issued", PaymentStatus = order.PaymentStatus, PaymentMethod = order.PaymentMethod,
            CustomerName = order.Customer?.FullName ?? "Khách lẻ", CustomerPhone = order.Customer?.Phone,
            CustomerEmail = order.Customer?.Email, CustomerAddress = order.Customer?.Address,
            Subtotal = order.Subtotal, DiscountAmount = order.Discount, TotalAmount = order.TotalAmount,
            IssuedAt = now, UpdatedAt = now,
            Items = order.OrderItems.Select(i => new InvoiceItem { ProductId = i.ProductId,
                ProductName = i.Product?.ProductName ?? "Sản phẩm", Sku = i.Product?.Sku,
                Quantity = i.Quantity, UnitPrice = i.UnitPrice, TotalPrice = i.TotalPrice }).ToList() };
        _db.Invoices.Add(invoice);
        try { await _db.SaveChangesAsync(); return invoice; }
        catch (DbUpdateException)
        {
            // Concurrent order/payment transitions may both try to create the same invoice.
            _db.Entry(invoice).State = EntityState.Detached;
            var concurrentInvoice = await _db.Invoices.Include(i => i.Items).FirstOrDefaultAsync(i => i.OrderId == orderId);
            if (concurrentInvoice != null) return concurrentInvoice;
            throw;
        }
    }

    public async Task SyncOrderLifecycleAsync(int orderId)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) return;
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.OrderId == orderId);
        if (order.Status == "cancelled")
        {
            if (invoice != null && invoice.InvoiceStatus != "refunded") { invoice.InvoiceStatus = "voided"; invoice.UpdatedAt = DateTime.UtcNow; await _db.SaveChangesAsync(); }
            return;
        }
        if (order.PaymentStatus == "refunded" || order.Status == "refunded")
        {
            if (invoice != null) { invoice.InvoiceStatus = "refunded"; invoice.PaymentStatus = "refunded"; invoice.UpdatedAt = DateTime.UtcNow; await _db.SaveChangesAsync(); }
            return;
        }
        if (order.Status is "processing" or "completed" || order.PaymentStatus == "paid")
            invoice = await EnsureInvoiceForOrderAsync(orderId);
        if (invoice != null)
        {
            invoice.PaymentStatus = order.PaymentStatus;
            invoice.PaymentMethod = order.PaymentMethod;
            if (order.PaymentStatus == "paid") invoice.InvoiceStatus = "paid";
            else if (invoice.InvoiceStatus == "paid") invoice.InvoiceStatus = "issued";
            invoice.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<PagedResult<InvoiceDTO>> GetInvoicesAsync(int page, int pageSize, DateTime? from, DateTime? to, string? paymentStatus, string? customerSearch = null)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.Invoices.AsNoTracking().AsQueryable();
        if (from.HasValue) query = query.Where(i => i.IssuedAt >= from.Value);
        if (to.HasValue) query = query.Where(i => i.IssuedAt < to.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(paymentStatus)) query = query.Where(i => i.PaymentStatus == paymentStatus);
        if (!string.IsNullOrWhiteSpace(customerSearch))
        {
            var keyword = customerSearch.Trim();
            query = query.Where(i =>
                (i.CustomerName != null && i.CustomerName.Contains(keyword)) ||
                (i.CustomerPhone != null && i.CustomerPhone.Contains(keyword)) ||
                (i.CustomerEmail != null && i.CustomerEmail.Contains(keyword)));
        }
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(i => i.IssuedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(i => new InvoiceDTO { InvoiceId = i.Id, OrderId = i.OrderId, InvoiceNumber = i.InvoiceNumber,
                OrderNumber = i.Order != null ? i.Order.OrderNumber : "", InvoiceStatus = i.InvoiceStatus,
                IssuedAt = i.IssuedAt, PaymentStatus = i.PaymentStatus, PaymentMethod = i.PaymentMethod,
                Subtotal = i.Subtotal, Discount = i.DiscountAmount, TaxAmount = i.TaxAmount, FeeAmount = i.ShippingFee,
                TotalAmount = i.TotalAmount, CustomerName = i.CustomerName, CustomerPhone = i.CustomerPhone })
            .ToListAsync();
        return new PagedResult<InvoiceDTO> { Items = items, TotalItems = total, PageNumber = page, PageSize = pageSize, TotalPages = (int)Math.Ceiling(total / (double)pageSize) };
    }

    public async Task<InvoiceDTO?> GetInvoiceAsync(int orderId)
    {
        var i = await _db.Invoices.AsNoTracking().Include(x => x.Items).Include(x => x.Order)
            .FirstOrDefaultAsync(x => x.OrderId == orderId);
        return i == null ? null : new InvoiceDTO { InvoiceId = i.Id, OrderId = i.OrderId,
            InvoiceNumber = i.InvoiceNumber, OrderNumber = i.Order?.OrderNumber ?? "", InvoiceStatus = i.InvoiceStatus,
            IssuedAt = i.IssuedAt, PaymentStatus = i.PaymentStatus, PaymentMethod = i.PaymentMethod,
            Subtotal = i.Subtotal, Discount = i.DiscountAmount, TaxAmount = i.TaxAmount, FeeAmount = i.ShippingFee,
            TotalAmount = i.TotalAmount, CustomerName = i.CustomerName, CustomerPhone = i.CustomerPhone,
            CustomerEmail = i.CustomerEmail, CustomerAddress = i.CustomerAddress,
            Items = i.Items.Select(x => new InvoiceItemDTO { ProductName = x.ProductName, Sku = x.Sku,
                Quantity = x.Quantity, UnitPrice = x.UnitPrice, TotalPrice = x.TotalPrice }).ToList() };
    }

}
