using backend.Data;
using backend.DTO;
using Microsoft.EntityFrameworkCore;

namespace backend.Repository;

/// <summary>DAL: returns flat projections and performs grouping in SQL; no pivot/business calculations here.</summary>
public sealed class RevenueAnalyticsRepository(AppDbContext db)
{
    public Task<decimal> GetRevenueAsync(DateTime startInclusive, DateTime endExclusive, CancellationToken ct)
    {
        var orders = db.Orders.AsNoTracking().Where(o => o.Status == "completed" &&
            (o.PaymentStatus == "paid" || o.PaymentStatus == "refunded") &&
            o.CreatedAt >= startInclusive && o.CreatedAt < endExclusive);
        return orders.Select(o => o.PaymentStatus == "refunded" ? -o.TotalAmount : o.TotalAmount).SumAsync(ct);
    }

    public async Task<RevenueAnalyticsRawDTO> LoadAsync(int firstYear, int lastYear, CancellationToken ct)
    {
        var start = new DateTime(firstYear, 1, 1);
        var end = new DateTime(lastYear + 1, 1, 1);
        var orders = db.Orders.AsNoTracking().Where(o => o.Status == "completed" &&
            (o.PaymentStatus == "paid" || o.PaymentStatus == "refunded") && o.CreatedAt >= start && o.CreatedAt < end);
        var orderRows = await orders.Select(o => new RevenueOrderRawDTO
        {
            Date = o.CreatedAt,
            CustomerId = o.CustomerId,
            CustomerName = o.Customer == null ? null : o.Customer.FullName,
            EmployeeId = o.User == null ? null : o.User.EmployeeId,
            EmployeeName = o.User == null ? null : o.User.Employee == null ? o.User.FullName : o.User.Employee.FullName,
            SellerUserId = o.UserId,
            Revenue = o.PaymentStatus == "refunded" ? -o.TotalAmount : o.TotalAmount
        }).ToListAsync(ct);

        var purchases = await db.PurchaseOrders.AsNoTracking()
            .Where(p => p.Status == "completed" && p.CreatedAt >= start && p.CreatedAt < end)
            .Select(p => new RevenuePurchaseRawDTO { Date = p.CreatedAt, Cost = p.TotalAmount }).ToListAsync(ct);

        var soldItems = await db.OrderItems.AsNoTracking()
            .Where(i => i.Order != null && i.Order.Status == "completed" &&
                        (i.Order.PaymentStatus == "paid" || i.Order.PaymentStatus == "refunded") &&
                        i.Order.CreatedAt >= start && i.Order.CreatedAt < end)
            .Select(i => new RevenueProductRawDTO { Id = i.ProductId, Name = i.Product == null ? "(Đã xóa)" : i.Product.ProductName,
                Date = i.Order!.CreatedAt, Revenue = i.Order.PaymentStatus == "refunded"
                    ? -(i.UnitPrice * i.Quantity) : i.UnitPrice * i.Quantity }).ToListAsync(ct);

        var employees = await db.Employees.AsNoTracking().Where(e => e.IsActive)
            .Select(e => new RevenuePersonRawDTO { Id = e.Id, Name = e.FullName }).ToListAsync(ct);
        // Admin (chủ cửa hàng) accounts have no employee profile but still create orders directly.
        var admins = await db.Users.AsNoTracking()
            .Where(u => u.EmployeeId == null && u.RoleEntity.Name.ToLower() == "admin")
            .Select(u => new RevenuePersonRawDTO { Id = u.Id, Name = u.FullName, IsActive = u.IsActive }).ToListAsync(ct);
        var customers = await db.Customers.AsNoTracking()
            .Select(c => new RevenuePersonRawDTO { Id = c.Id, Name = c.FullName }).ToListAsync(ct);
        var products = await db.Products.AsNoTracking()
            .Select(p => new RevenueProductRawDTO { Id = p.Id, Name = p.ProductName }).ToListAsync(ct);

        return new RevenueAnalyticsRawDTO { Orders = orderRows, Purchases = purchases, SoldItems = soldItems,
            Employees = employees, Admins = admins, Customers = customers, Products = products };
    }
}
