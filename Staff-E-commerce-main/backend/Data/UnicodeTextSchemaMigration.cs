using Microsoft.EntityFrameworkCore;

namespace backend.Data;

/// <summary>
/// inventory_adjustments.reason was created as VARCHAR, so Vietnamese reasons ("Kiểm kê", "Hủy đơn", "Nhập hàng")
/// were stored with '?' in place of accented letters. Widen it to NVARCHAR once; running again is a no-op.
/// The old "DEFAULT NULL" created an auto-named default constraint that blocks ALTER COLUMN, so drop it first
/// (NULL is the default anyway).
/// </summary>
public static class UnicodeTextSchemaMigration
{
    public static Task MigrateAsync(AppDbContext db) => db.Database.ExecuteSqlRawAsync("""
        IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'inventory_adjustments' AND COLUMN_NAME = 'reason' AND DATA_TYPE = 'varchar')
        BEGIN
            DECLARE @constraint SYSNAME = (
                SELECT dc.name FROM sys.default_constraints dc
                JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID(N'dbo.inventory_adjustments') AND c.name = 'reason');
            IF @constraint IS NOT NULL
            BEGIN
                DECLARE @drop NVARCHAR(400) = N'ALTER TABLE dbo.inventory_adjustments DROP CONSTRAINT ' + QUOTENAME(@constraint);
                EXEC sp_executesql @drop;
            END
            ALTER TABLE dbo.inventory_adjustments ALTER COLUMN reason NVARCHAR(255) NULL;
        END
        """);
}
