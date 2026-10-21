using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Data;
using backend.DTO;
using backend.Helpers;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed class PosCheckoutService(AppDbContext db, IHttpContextAccessor accessor, InvoiceService invoices)
{
    private int UserId => int.TryParse(accessor.HttpContext?.User.FindFirst("uid")?.Value, out var id)
        ? id : throw new UnauthorizedAccessException("Không xác định được nhân viên.");

    // Serializes POS lifecycle changes across processes; inventory debits also have a conditional SQL check.
    private async Task LockAsync() => await db.Database.ExecuteSqlRawAsync("""
        DECLARE @result INT;
        EXEC @result = sys.sp_getapplock @Resource = 'pos-checkout', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @result < 0 THROW 51000, 'POS is busy. Please retry.', 1;
        """);

    private static decimal Discount(Promotion p, decimal amount)
    {
        var value = p.DiscountType == "percent" ? decimal.Floor(amount * p.Value / 100m) : p.Value;
        if (p.MaxDiscount.HasValue) value = Math.Min(value, p.MaxDiscount.Value);
        return Math.Clamp(value, 0, amount);
    }

    private static bool Active(Promotion p) => !p.IsDeleted && p.Status == "active" &&
        DateTimeHelper.IsWithinRange(p.StartDate, p.EndDate) && (!p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit);

    public async Task<PosCheckoutResponse> CheckoutAsync(PosCheckoutRequest request)
    {
        var userId = UserId;
        if (!Guid.TryParse(request.RequestId, out var requestKey)) throw new ArgumentException("Mã yêu cầu không hợp lệ.");
        if (request.Items == null || request.Items.Count is < 1 or > 200 || request.Items.Any(i => i.ProductId <= 0 || i.Quantity is < 1 or > 1000) || request.PointsUsed < 0)
            throw new ArgumentException("Giỏ hàng hoặc số lượng không hợp lệ.");
        var lines = request.Items.GroupBy(i => i.ProductId).Select(g => new PosCheckoutLine { ProductId = g.Key, Quantity = g.Sum(i => i.Quantity) }).OrderBy(i => i.ProductId).ToList();
        if (lines.Any(i => i.Quantity > 1000)) throw new ArgumentException("Số lượng mỗi sản phẩm không được vượt quá 1.000.");
        var method = request.PaymentMethod?.Trim().ToLowerInvariant() switch
        { "cash" => "cash", "other" or "momo" or "e_wallet" => "e_wallet", _ => throw new ArgumentException("Chỉ hỗ trợ thanh toán tiền mặt hoặc MoMo.") };
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        { request.CustomerId, request.PointsUsed, request.PromotionId, method, request.CashReceived, request.ExpectedTotal, request.Note, lines }))));
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await LockAsync();
        var key = requestKey.ToString();
        var existing = await db.Orders.FirstOrDefaultAsync(o => o.CheckoutKey == key);
        if (existing != null)
        {
            if (existing.UserId != userId || existing.CheckoutHash != hash) throw new InvalidOperationException("Mã yêu cầu đã được dùng cho một giỏ hàng khác.");
            var replay = await GetAsync(existing.Id);
            await transaction.CommitAsync();
            return replay;
        }

        Customer? customer = null;
        if (request.CustomerId.HasValue)
            customer = await db.Customers.SingleOrDefaultAsync(c => c.Id == request.CustomerId && c.IsActive)
                ?? throw new ArgumentException("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
        if (request.PointsUsed > 0 && customer == null) throw new ArgumentException("Chọn khách hàng để sử dụng điểm.");
        var productIds = lines.Select(i => i.ProductId).ToList();
        var products = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id);
        if (products.Count != productIds.Count) throw new ArgumentException("Có sản phẩm không tồn tại hoặc đã ngừng bán.");
        var productPromotions = await db.ProductPromotions.Include(p => p.Promotion).Where(p => productIds.Contains(p.ProductId)).ToListAsync();
        var usedPromotions = new Dictionary<int, Promotion>();
        var now = DateTime.UtcNow;
        var items = new List<OrderItem>();
        foreach (var line in lines)
        {
            var product = products[line.ProductId];
            if (product.Price < 0) throw new InvalidOperationException("Giá sản phẩm không hợp lệ.");
            var best = productPromotions.Where(p => p.ProductId == product.Id && p.Promotion != null && p.Promotion.Type == "product" && Active(p.Promotion))
                .OrderByDescending(p => Discount(p.Promotion!, product.Price)).FirstOrDefault();
            var price = decimal.Round(product.Price - (best == null ? 0 : Discount(best.Promotion!, product.Price)), 2);
            if (best != null) usedPromotions[best.PromotionId] = best.Promotion!;
            items.Add(new OrderItem { ProductId = product.Id, Quantity = line.Quantity, UnitPrice = price, TotalPrice = price * line.Quantity, CreatedAt = now });
        }
        var subtotal = items.Sum(i => i.TotalPrice);
        decimal discount = 0;
        if (request.PromotionId.HasValue)
        {
            var promotion = await db.Promotions.Include(p => p.EventDetails).SingleOrDefaultAsync(p => p.Id == request.PromotionId);
            if (promotion == null || !Active(promotion) || promotion.Type is not ("voucher" or "event"))
                throw new ArgumentException("Khuyến mãi không còn hợp lệ.");
            if (subtotal < (promotion.EventDetails?.MinOrderAmount ?? 0)) throw new ArgumentException("Đơn hàng chưa đạt mức tối thiểu của khuyến mãi.");
            discount = Discount(promotion, subtotal);
            usedPromotions[promotion.Id] = promotion;
        }
        if (request.PointsUsed > (customer?.RewardPoints ?? 0) || request.PointsUsed > decimal.Floor((subtotal - discount) / 1000m))
            throw new ArgumentException("Số điểm yêu cầu vượt số dư hoặc số tiền có thể giảm.");
        discount += request.PointsUsed * 1000m;
        var total = subtotal - discount;
        if (total > 9999999999m) throw new ArgumentException("Giá trị đơn hàng vượt giới hạn.");
        if (request.ExpectedTotal.HasValue && request.ExpectedTotal.Value != total)
            throw new InvalidOperationException($"Giá hoặc ưu đãi đã thay đổi. Số tiền phải trả hiện tại là {total:N0} ₫. Vui lòng kiểm tra lại giỏ hàng.");
        if (method == "cash" && (!request.CashReceived.HasValue || request.CashReceived < total || request.CashReceived > 9999999999m))
            throw new ArgumentException("Tiền khách đưa phải đủ số tiền cần thanh toán.");

        var order = new Order
        {
            OrderNumber = $"POS-{Guid.NewGuid():N}", OrderType = "pos", UserId = userId, CustomerId = customer?.Id, Customer = customer,
            CheckoutKey = key, CheckoutHash = hash, Status = "pending", PaymentStatus = "pending", PaymentMethod = method,
            Subtotal = subtotal, Discount = discount, TotalAmount = total, PromotionId = request.PromotionId,
            PointsUsed = request.PointsUsed, CashReceived = method == "cash" ? request.CashReceived : null,
            Note = request.Note?.Trim(), CreatedAt = now, UpdatedAt = now, OrderItems = items
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        foreach (var line in lines)
        {
            var updated = await db.Inventory.Where(i => i.ProductId == line.ProductId && i.Quantity >= line.Quantity)
                .ExecuteUpdateAsync(update => update.SetProperty(i => i.Quantity, i => i.Quantity - line.Quantity).SetProperty(i => i.UpdatedAt, now));
            if (updated != 1) throw new InvalidOperationException($"Sản phẩm {products[line.ProductId].ProductName} không đủ tồn kho.");
            db.InventoryAdjustments.Add(new InventoryAdjustment { ProductId = line.ProductId, ChangeAmount = -line.Quantity, Reason = $"Xuất bán {order.OrderNumber}", UserId = userId, CreatedAt = now });
        }
        if (customer != null) { customer.RewardPoints -= request.PointsUsed; customer.UpdatedAt = now; }
        foreach (var promotion in usedPromotions.Values)
        {
            promotion.UsedCount++;
            db.PromotionRedemptions.Add(new PromotionRedemption { PromotionId = promotion.Id, OrderId = order.Id, CustomerId = customer?.Id, RedeemedAt = now });
        }
        if (method == "cash" || total == 0) Complete(order, method, $"POS-{key}");
        db.ActivityLogs.Add(new ActivityLog { UserId = userId, Action = "pos_checkout", EntityType = "orders", EntityId = order.Id.ToString(), CreatedAt = now });
        await db.SaveChangesAsync();
        if (order.PaymentStatus == "paid") await invoices.SyncOrderLifecycleAsync(order.Id);
        var response = await GetAsync(order.Id);
        await transaction.CommitAsync();
        return response;
    }

    private void Complete(Order order, string method, string reference)
    {
        order.Status = "completed"; order.PaymentStatus = "paid"; order.UpdatedAt = DateTime.UtcNow;
        order.PointsEarned = order.CustomerId.HasValue ? (int)decimal.Floor(order.TotalAmount / 10000m) : 0;
        if (order.Customer != null) { order.Customer.RewardPoints += order.PointsEarned; order.Customer.UpdatedAt = order.UpdatedAt; }
        var payment = order.Payments.FirstOrDefault(p => p.TransactionRef == reference);
        if (payment == null)
        {
            payment = new Payment { Amount = order.TotalAmount, Method = method == "e_wallet" ? "other" : method, TransactionRef = reference, CreatedAt = order.UpdatedAt };
            order.Payments.Add(payment);
        }
        payment.Status = "completed";
    }

    public async Task<PosCheckoutResponse> ConfirmAsync(int orderId, decimal amount, string reference, bool momo = false)
    {
        if (string.IsNullOrWhiteSpace(reference) || reference.Length > 200) throw new ArgumentException("Nhập mã giao dịch xác nhận thu tiền.");
        reference = reference.Trim();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await LockAsync();
        var order = await db.Orders.Include(o => o.Customer).Include(o => o.Payments).SingleOrDefaultAsync(o => o.Id == orderId && o.CheckoutKey != null)
            ?? throw new ArgumentException("Không tìm thấy đơn POS.");
        if (amount != order.TotalAmount || order.PaymentMethod != (momo ? "e_wallet" : "card"))
            throw new ArgumentException("Số tiền hoặc phương thức không khớp đơn hàng.");
        if (order.PaymentStatus == "paid")
        {
            if (!order.Payments.Any(p => p.Status == "completed" && p.TransactionRef == reference))
                throw new InvalidOperationException("Đơn đã được thanh toán bằng giao dịch khác.");
        }
        else
        {
            if (order.Status != "pending" || order.PaymentStatus != "pending") throw new InvalidOperationException("Đơn không còn chờ thanh toán.");
            if (await db.Payments.AnyAsync(p => p.Status == "completed" && p.TransactionRef == reference && p.OrderId != orderId))
                throw new InvalidOperationException("Mã giao dịch đã được ghi nhận cho đơn khác.");
            Complete(order, order.PaymentMethod!, reference.Trim());
            db.ActivityLogs.Add(new ActivityLog { UserId = momo ? order.UserId : UserId, Action = "pos_payment_confirmed", EntityType = "orders", EntityId = order.Id.ToString(), CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            await invoices.SyncOrderLifecycleAsync(order.Id);
        }
        var result = await GetAsync(orderId);
        await transaction.CommitAsync();
        return result;
    }

    public async Task<bool> CancelAsync(int orderId)
    {
        var userId = UserId;
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await LockAsync();
        var order = await db.Orders.Include(o => o.OrderItems).Include(o => o.Customer).SingleAsync(o => o.Id == orderId);
        if (order.Status == "cancelled") return true;
        if (order.Status != "pending" || order.PaymentStatus != "pending") throw new InvalidOperationException("Chỉ hủy được đơn POS chưa thanh toán.");
        var now = DateTime.UtcNow;
        foreach (var item in order.OrderItems)
        {
            if (await db.Inventory.Where(i => i.ProductId == item.ProductId).ExecuteUpdateAsync(u => u
                .SetProperty(i => i.Quantity, i => i.Quantity + item.Quantity).SetProperty(i => i.UpdatedAt, now)) != 1)
                throw new InvalidOperationException("Không thể hoàn tồn kho.");
            db.InventoryAdjustments.Add(new InventoryAdjustment { ProductId = item.ProductId, ChangeAmount = item.Quantity, Reason = $"Hủy {order.OrderNumber}", UserId = userId, CreatedAt = now });
        }
        if (order.Customer != null) { order.Customer.RewardPoints += order.PointsUsed; order.Customer.UpdatedAt = now; }
        var redemptions = await db.PromotionRedemptions.Where(p => p.OrderId == orderId).ToListAsync();
        var promotionIds = redemptions.Select(p => p.PromotionId).Distinct().ToList();
        foreach (var promotion in await db.Promotions.Where(p => promotionIds.Contains(p.Id)).ToListAsync()) promotion.UsedCount = Math.Max(0, promotion.UsedCount - 1);
        db.PromotionRedemptions.RemoveRange(redemptions);
        order.Status = "cancelled"; order.UpdatedAt = now;
        db.ActivityLogs.Add(new ActivityLog { UserId = userId, Action = "pos_cancelled", EntityType = "orders", EntityId = orderId.ToString(), CreatedAt = now });
        await db.SaveChangesAsync();
        await invoices.SyncOrderLifecycleAsync(orderId);
        await transaction.CommitAsync();
        return true;
    }

    public async Task<PosCheckoutResponse> GetAsync(int id)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.User).Include(o => o.Customer).Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .SingleOrDefaultAsync(o => o.Id == id && o.CheckoutKey != null) ?? throw new ArgumentException("Không tìm thấy đơn POS.");
        return new PosCheckoutResponse { Id = order.Id, OrderNumber = order.OrderNumber, Status = order.Status, PaymentStatus = order.PaymentStatus,
            PaymentMethod = order.PaymentMethod, Subtotal = order.Subtotal, Discount = order.Discount, TotalAmount = order.TotalAmount,
            CashReceived = order.CashReceived, ChangeDue = order.CashReceived.HasValue ? order.CashReceived.Value - order.TotalAmount : 0,
            PointsUsed = order.PointsUsed, PointsEarned = order.PointsEarned, CustomerName = order.Customer?.FullName, CreatedAt = order.CreatedAt,
            CustomerId = order.CustomerId, UserId = order.UserId, UserName = order.User?.FullName, PromotionId = order.PromotionId, Note = order.Note, UpdatedAt = order.UpdatedAt,
            Items = order.OrderItems.Select(i => new PosCheckoutItemResponse { ProductId = i.ProductId, ProductName = i.Product?.ProductName ?? "", Quantity = i.Quantity, UnitPrice = i.UnitPrice, TotalPrice = i.TotalPrice }).ToList() };
    }
}
