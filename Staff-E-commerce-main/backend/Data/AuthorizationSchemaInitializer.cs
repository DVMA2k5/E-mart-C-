namespace backend.Data;

public static class AuthorizationSchemaInitializer
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await DatabaseSchemaInitializer.InitializeAsync(db);
        // Structured delivery data requires the existing C# parser for legacy notes.
        await OrderDeliverySchemaMigration.MigrateAsync(db);
    }
}
