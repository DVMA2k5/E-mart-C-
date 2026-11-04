using Microsoft.EntityFrameworkCore;

namespace backend.Data;

/// <summary>
/// Early app versions let customers pick their own username (e.g. "DVMA"); customers now always sign in with
/// their phone number. Rename such accounts to their profile phone. Skips a phone already used as another
/// username, and bumps session_version so old tokens re-login. Running it again changes nothing.
/// </summary>
public static class CustomerUsernameMigration
{
    public static Task MigrateAsync(AppDbContext db) => db.Database.ExecuteSqlRawAsync("""
        UPDATE u
        SET u.username = LTRIM(RTRIM(c.phone)),
            u.session_version = u.session_version + 1,
            u.updated_at = GETUTCDATE()
        FROM dbo.users u
        JOIN dbo.roles r ON r.id = u.role_id AND r.name = 'customer'
        JOIN dbo.customers c ON c.id = u.customer_id
        WHERE c.phone IS NOT NULL AND LTRIM(RTRIM(c.phone)) <> ''
          AND u.username <> LTRIM(RTRIM(c.phone))
          AND NOT EXISTS (SELECT 1 FROM dbo.users other WHERE other.username = LTRIM(RTRIM(c.phone)) AND other.id <> u.id);
        """);
}
