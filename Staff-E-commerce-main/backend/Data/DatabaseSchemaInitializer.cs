using System.Data;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace backend.Data;

/// <summary>Runs the same canonical schema used by SSMS and setup-db.ps1.</summary>
public static class DatabaseSchemaInitializer
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        var target = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
        if (string.IsNullOrWhiteSpace(target.InitialCatalog))
            throw new InvalidOperationException("DefaultConnection must specify a database.");

        // Create the configured database only when it does not already exist.
        var master = new SqlConnectionStringBuilder(target.ConnectionString) { InitialCatalog = "master" };
        await using (var connection = new SqlConnection(master.ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                IF DB_ID(@name) IS NULL
                BEGIN
                    DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(@name) + N' COLLATE Vietnamese_CI_AS;';
                    EXEC sys.sp_executesql @sql;
                END;
                """;
            command.Parameters.AddWithValue("@name", target.InitialCatalog);
            await command.ExecuteNonQueryAsync();
        }

        await using var resource = typeof(DatabaseSchemaInitializer).Assembly
            .GetManifestResourceStream("backend.Data.store_management_full.sql")
            ?? throw new InvalidOperationException("The embedded database schema is missing.");
        using var reader = new StreamReader(resource);
        var script = await reader.ReadToEndAsync();
        const string start = "-- BEGIN APPLICATION SCHEMA";
        const string end = "-- END APPLICATION SCHEMA";
        var startIndex = script.IndexOf(start, StringComparison.Ordinal);
        var endIndex = script.IndexOf(end, StringComparison.Ordinal);
        if (startIndex < 0 || endIndex <= startIndex)
            throw new InvalidOperationException("The database schema section is invalid.");
        script = script[(startIndex + start.Length)..endIndex];
        // SQL clients without MARS can span GO batches with BEGIN/COMMIT.
        // EF's MARS connection requires an explicitly enlisted client transaction.
        script = Regex.Replace(script, @"(?m)^BEGIN TRANSACTION;\r?$", "");
        script = Regex.Replace(script, @"(?m)^COMMIT TRANSACTION;\r?$", "");

        var wasOpen = db.Database.GetDbConnection().State == ConnectionState.Open;
        if (!wasOpen) await db.Database.OpenConnectionAsync();
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            // Keep one connection for all GO batches: the SQL transaction and
            // application lock cover the complete upgrade, including renames.
            foreach (var batch in Regex.Split(script, @"(?im)^\s*GO\s*;?\s*$"))
            {
                if (string.IsNullOrWhiteSpace(batch)) continue;
                await using var command = db.Database.GetDbConnection().CreateCommand();
                command.CommandText = batch;
                command.CommandTimeout = 120;
                command.Transaction = transaction.GetDbTransaction();
                await command.ExecuteNonQueryAsync();
            }
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
        finally
        {
            if (!wasOpen) await db.Database.CloseConnectionAsync();
        }
    }
}
