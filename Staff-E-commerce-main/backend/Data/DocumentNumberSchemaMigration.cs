using System.Data;
using backend.Helpers;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DocumentNumberSchemaMigration
{
    private const string MigrationName = "short-document-numbers-v1";

    public static async Task MigrateAsync(AppDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM authorization_migrations WITH (UPDLOCK, HOLDLOCK) WHERE name = {MigrationName}")
            .AnyAsync(count => count > 0))
        {
            await transaction.CommitAsync();
            return;
        }

        // Move every old value out of the final namespace first so unique indexes
        // cannot conflict while GUID-based document numbers are being replaced.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE orders SET order_number = CONCAT('TMP-DH-', id);
            UPDATE invoices SET invoice_number = CONCAT('TMP-INV-', id);
            """);

        var orders = await db.Orders.ToListAsync();
        foreach (var order in orders)
            order.OrderNumber = DocumentNumber.Order(order.Id);

        var invoices = await db.Invoices.ToListAsync();
        foreach (var invoice in invoices)
            invoice.InvoiceNumber = DocumentNumber.Invoice(invoice.OrderId);

        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO authorization_migrations (name) VALUES ({MigrationName})");
        await transaction.CommitAsync();
    }
}
