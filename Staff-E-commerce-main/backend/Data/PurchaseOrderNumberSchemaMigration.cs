using System.Data;
using backend.Helpers;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class PurchaseOrderNumberSchemaMigration
{
    private const string MigrationName = "short-purchase-order-numbers-v1";

    public static async Task MigrateAsync(AppDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM authorization_migrations WITH (UPDLOCK, HOLDLOCK) WHERE name = {MigrationName}")
            .AnyAsync(count => count > 0))
        {
            await transaction.CommitAsync();
            return;
        }

        await db.Database.ExecuteSqlRawAsync("UPDATE purchase_orders SET po_code = CONCAT('TMP-PN-', id);");
        var purchaseOrders = await db.PurchaseOrders.ToListAsync();
        foreach (var purchaseOrder in purchaseOrders)
            purchaseOrder.PoCode = DocumentNumber.PurchaseOrder(purchaseOrder.Id);

        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO authorization_migrations (name) VALUES ({MigrationName})");
        await transaction.CommitAsync();
    }
}
