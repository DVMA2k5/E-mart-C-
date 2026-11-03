using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class VoucherWalletSchemaMigration
{
    public static async Task MigrateAsync(AppDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("""
            DECLARE @result INT;
            EXEC @result = sys.sp_getapplock @Resource = 'voucher-wallet-schema', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
            IF @result < 0 THROW 51000, 'Voucher schema is busy.', 1;
            IF COL_LENGTH('voucher_promotions', 'visibility') IS NULL
                ALTER TABLE voucher_promotions ADD visibility nvarchar(20) NOT NULL CONSTRAINT df_voucher_visibility DEFAULT 'public';
            IF COL_LENGTH('voucher_promotions', 'send_to_customers') IS NULL
                ALTER TABLE voucher_promotions ADD send_to_customers bit NOT NULL CONSTRAINT df_voucher_send DEFAULT 0;
            IF COL_LENGTH('voucher_promotions', 'claim_start_date') IS NULL
                ALTER TABLE voucher_promotions ADD claim_start_date datetime2 NULL;
            IF COL_LENGTH('voucher_promotions', 'claim_end_date') IS NULL
                ALTER TABLE voucher_promotions ADD claim_end_date datetime2 NULL;
            IF COL_LENGTH('voucher_promotions', 'claim_limit') IS NULL
                ALTER TABLE voucher_promotions ADD claim_limit int NULL;
            IF COL_LENGTH('voucher_promotions', 'claimed_count') IS NULL
                ALTER TABLE voucher_promotions ADD claimed_count int NOT NULL CONSTRAINT df_voucher_claimed DEFAULT 0;
            IF OBJECT_ID('customer_vouchers', 'U') IS NULL
            BEGIN
                CREATE TABLE customer_vouchers (
                    id int IDENTITY(1,1) PRIMARY KEY,
                    promotion_id int NOT NULL REFERENCES promotions(id),
                    customer_id int NOT NULL REFERENCES customers(id),
                    claimed_at datetime2 NOT NULL,
                    source nvarchar(20) NOT NULL,
                    order_id int NULL REFERENCES orders(id),
                    used_at datetime2 NULL
                );
                CREATE UNIQUE INDEX ux_customer_vouchers_owner ON customer_vouchers(promotion_id, customer_id);
                CREATE INDEX ix_customer_vouchers_order ON customer_vouchers(order_id);
            END;
            """);
        // Run once: retain prior ownership/use without inventing claims for every customer.
        await db.Database.ExecuteSqlRawAsync("""
            IF NOT EXISTS (SELECT 1 FROM authorization_migrations WHERE name = 'voucher-wallet-v1')
            BEGIN
                UPDATE v SET claim_start_date = p.start_date, claim_end_date = p.end_date, claim_limit = p.usage_limit
                FROM voucher_promotions v JOIN promotions p ON p.id = v.promotion_id;
                ;WITH history AS (
                    SELECT r.*, o.status AS order_status,
                        ROW_NUMBER() OVER (PARTITION BY r.promotion_id, r.customer_id ORDER BY
                            CASE WHEN o.status IN ('completed', 'refunded') THEN 0 ELSE 1 END, r.redeemed_at, r.id) AS rn
                    FROM promotion_redemptions r JOIN promotions p ON p.id = r.promotion_id
                    JOIN orders o ON o.id = r.order_id
                    WHERE p.type = 'voucher' AND r.customer_id IS NOT NULL AND o.status <> 'cancelled'
                )
                INSERT INTO customer_vouchers(promotion_id, customer_id, claimed_at, source, order_id, used_at)
                SELECT promotion_id, customer_id, redeemed_at, 'legacy', order_id,
                    CASE WHEN order_status IN ('completed', 'refunded') THEN redeemed_at ELSE NULL END
                FROM history WHERE rn = 1;
                DELETE r FROM promotion_redemptions r JOIN promotions p ON p.id = r.promotion_id
                JOIN orders o ON o.id = r.order_id WHERE p.type = 'voucher' AND o.status NOT IN ('completed', 'refunded');
                UPDATE v SET claimed_count = (SELECT COUNT(*) FROM customer_vouchers c WHERE c.promotion_id = v.promotion_id)
                FROM voucher_promotions v;
                UPDATE v SET claim_limit = claimed_count FROM voucher_promotions v WHERE claim_limit < claimed_count;
                UPDATE p SET used_count = (SELECT COUNT(*) FROM customer_vouchers c WHERE c.promotion_id = p.id AND c.used_at IS NOT NULL)
                FROM promotions p WHERE p.type = 'voucher';
                INSERT INTO authorization_migrations(name) VALUES ('voucher-wallet-v1');
            END;
            """);
        await transaction.CommitAsync();
    }
}
