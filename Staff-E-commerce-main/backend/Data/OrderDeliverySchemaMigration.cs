using System.Data;
using backend.Helpers;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class OrderDeliverySchemaMigration
{
    public static async Task MigrateAsync(AppDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        // The marker's key-range lock serializes initialization across API processes.
        if (await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM authorization_migrations WITH (UPDLOCK, HOLDLOCK) WHERE name = 'order-delivery-v1'").AnyAsync(count => count > 0))
        {
            await transaction.CommitAsync();
            return;
        }
        var orders = await db.Orders.Where(o => (o.OrderType == "mobile" || o.OrderNumber.StartsWith("WEB-"))
            && o.RecipientName == null && o.RecipientPhone == null && o.ShippingAddress == null
            && o.Note != null && o.Note.StartsWith("Người nhận:")).ToListAsync();
        foreach (var order in orders)
        {
            var delivery = OrderDeliveryDetails.Parse(order.Note);
            // Leave unrecognized/incomplete formats intact for manual reconciliation.
            if (delivery.Name == null || delivery.Phone == null || delivery.Address == null
                || delivery.Name.Length > 255 || delivery.Phone.Length > 50) continue;
            order.RecipientName = delivery.Name;
            order.RecipientPhone = delivery.Phone;
            order.ShippingAddress = delivery.Address;
            order.Note = delivery.Note;
        }
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync("INSERT INTO authorization_migrations (name) VALUES ('order-delivery-v1')");
        await transaction.CommitAsync();
    }
}
