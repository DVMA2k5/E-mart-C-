using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Data;
using backend.Middlewares;
using backend.Models;
using backend.Repository;
using backend.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Read-cache freshness (commit-driven invalidation, read/commit race, live storefront stock), payment-attempt
/// ordering, and the busy-lock → 503 mapping of GlobalExceptionMiddleware.
/// </summary>
public static class CacheAndBusyRegression
{
    public sealed record CacheProbe(decimal Price);

    public static async Task RunAsync(IServiceProvider services, HttpClient client, string connectionString, string adminToken)
    {
        var assertions = 0;
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception("Cache/busy regression failed: " + message);
            assertions++;
        }

        int productId = 0, orderId = 0;
        string buyerToken = "";
        await Db(async db =>
        {
            var buyer = new Customer { FullName = "Cache buyer", Phone = "0977777701", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var user = new User { Username = "0977777701", FullName = buyer.FullName, PasswordHash = "unused", Customer = buyer,
                RoleEntity = await db.Roles.SingleAsync(r => r.Name == "customer"), IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var product = new Product { ProductName = "Cache fixture", Price = 20000, StockQuantity = 10, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Users.Add(user); db.Products.Add(product);
            await db.SaveChangesAsync();
            productId = product.Id;
            using var jwtScope = services.CreateScope();
            buyerToken = jwtScope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(user).token;
            var order = new Order { OrderNumber = "CACHE-PAY-1", OrderType = "mobile", CustomerId = buyer.Id, Status = "pending",
                PaymentStatus = "pending", PaymentMethod = "e_wallet", TotalAmount = 20000, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Orders.Add(order);
            await db.SaveChangesAsync();
            orderId = order.Id;
        });

        // ---- 1. A commit that lands while the cache is loading must not leave the old value cached.
        var cache = services.GetRequiredService<BusMemoryCache<CacheProbe>>();
        cache.Clear();
        var readStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var commitDone = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var loads = 0;
        var loading = cache.GetOrCreateAsync(async () =>
        {
            var price = await ReadPriceAsync();
            if (Interlocked.Increment(ref loads) == 1)
            {
                readStarted.SetResult();
                await commitDone.Task; // the price changes and commits while this (old) value is in hand
            }
            return [new CacheProbe(price)];
        }, TimeSpan.FromMinutes(15));
        await readStarted.Task;
        await Db(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(u => u.SetProperty(p => p.Price, 25000m));
            await transaction.CommitAsync();
        });
        commitDone.SetResult();
        var (raced, _) = await loading;
        Check(loads == 2 && raced.Single().Price == 25000m, "a read overlapping a commit is reloaded, never returned stale");
        var (afterRace, fromDbAfterRace) = await cache.GetOrCreateAsync(Fail, TimeSpan.FromMinutes(15));
        Check(!fromDbAfterRace && afterRace.Single().Price == 25000m, "the reloaded value is what stays cached");

        // ---- 2. Uncommitted and rolled-back writes keep the cache; a commit evicts it immediately.
        await Db(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(u => u.SetProperty(p => p.Price, 26000m));
            var (_, beforeCommit) = await cache.GetOrCreateAsync(Fail, TimeSpan.FromMinutes(15));
            Check(!beforeCommit, "a write that is not committed yet does not evict the cache");
            await transaction.RollbackAsync();
        });
        var (_, afterRollback) = await cache.GetOrCreateAsync(Fail, TimeSpan.FromMinutes(15));
        Check(!afterRollback, "a rolled-back write does not evict the cache");
        await Db(async db =>
        {
            var product = await db.Products.SingleAsync(p => p.Id == productId);
            product.Price = 27000m;
            await db.SaveChangesAsync(); // SaveChanges without an explicit transaction
        });
        var (afterSave, reloaded) = await cache.GetOrCreateAsync(async () => [new CacheProbe(await ReadPriceAsync())], TimeSpan.FromMinutes(15));
        Check(reloaded && afterSave.Single().Price == 27000m, "SaveChanges evicts the cache once committed");

        // ---- 3. Storefront stock is always live, even when the catalogue copy is still cached.
        var first = await Call(HttpMethod.Get, $"/api/storefront/products/{productId}");
        Check(first.GetProperty("stockQuantity").GetInt32() == 10, "storefront shows the stock");
        await RawSqlAsync($"UPDATE products SET stock_quantity = 3 WHERE id = {productId}"); // bypasses EF: no eviction
        var live = await Call(HttpMethod.Get, $"/api/storefront/products/{productId}");
        Check(live.GetProperty("stockQuantity").GetInt32() == 3, "storefront overlays live stock on the cached catalogue");
        var page = await Call(HttpMethod.Get, "/api/storefront/products/page?pageSize=200");
        Check(page.GetProperty("items").EnumerateArray().Single(p => p.GetProperty("id").GetInt32() == productId)
            .GetProperty("stockQuantity").GetInt32() == 3, "product pages use live stock too");

        // ---- 4. Several payment attempts: a completed one wins, otherwise the newest one.
        await Db(async db =>
        {
            db.Payments.AddRange(
                new Payment { OrderId = orderId, Amount = 20000, Method = "other", TransactionRef = "cache-old-failed", Status = "failed", CreatedAt = DateTime.UtcNow.AddMinutes(-10) },
                new Payment { OrderId = orderId, Amount = 20000, Method = "other", TransactionRef = "cache-new-pending", Status = "pending", CreatedAt = DateTime.UtcNow.AddMinutes(-1) });
            await db.SaveChangesAsync();
        });
        Check((await LatestPaymentAsync())?.TransactionRef == "cache-new-pending", "newest attempt is reported when none completed");
        await Db(async db =>
        {
            db.Payments.Add(new Payment { OrderId = orderId, Amount = 20000, Method = "other", TransactionRef = "cache-completed", Status = "completed", CreatedAt = DateTime.UtcNow.AddMinutes(-5) });
            await db.SaveChangesAsync();
        });
        Check((await LatestPaymentAsync())?.TransactionRef == "cache-completed", "a completed attempt wins over newer pending ones");

        // ---- 5. Checkout lock held elsewhere → 503 + Retry-After + JSON message, and the same request succeeds later.
        var checkout = new
        {
            requestId = Guid.NewGuid().ToString(), fullName = "Cache buyer", phone = "0977777701", address = "1 Đường Thử",
            paymentMethod = "cod", pointsUsed = 0, items = new[] { new { productId, quantity = 1 } }
        };
        await using (var holder = new SqlConnection(connectionString))
        {
            await holder.OpenAsync();
            await using var lockTransaction = (SqlTransaction)await holder.BeginTransactionAsync();
            await using (var take = new SqlCommand(
                "EXEC sp_getapplock @Resource = 'storefront-checkout', @LockMode = 'Exclusive', @LockOwner = 'Transaction'", holder, lockTransaction))
                await take.ExecuteNonQueryAsync();

            using var busyRequest = new HttpRequestMessage(HttpMethod.Post, "/api/storefront/orders") { Content = JsonContent.Create(checkout) };
            busyRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
            using var busy = await client.SendAsync(busyRequest);
            var busyBody = await busy.Content.ReadFromJsonAsync<JsonElement>();
            Check(busy.StatusCode == HttpStatusCode.ServiceUnavailable, $"lock time-out returns 503 (got {(int)busy.StatusCode})");
            Check(busy.Headers.RetryAfter != null, "503 carries Retry-After");
            Check(busyBody.GetProperty("message").GetString() == GlobalExceptionMiddleware.BusyMessage &&
                  busyBody.GetProperty("retryable").GetBoolean(), "503 carries the Vietnamese busy message");
            await lockTransaction.RollbackAsync();
        }
        var placed = await Call(HttpMethod.Post, "/api/storefront/orders", checkout, buyerToken);
        Check(placed.GetProperty("id").GetInt32() > 0 && !placed.GetProperty("replay").GetBoolean(), "retrying the same request after the lock is released places the order once");

        // ---- 6. Same for the POS, whose controller catches every exception itself (this.ServerError).
        var posSale = new { requestId = Guid.NewGuid().ToString(), paymentMethod = "cash", cashReceived = 50000, pointsUsed = 0,
            items = new[] { new { productId, quantity = 1 } } };
        await using (var holder = new SqlConnection(connectionString))
        {
            await holder.OpenAsync();
            await using var lockTransaction = (SqlTransaction)await holder.BeginTransactionAsync();
            await using (var take = new SqlCommand(
                "EXEC sp_getapplock @Resource = 'pos-checkout', @LockMode = 'Exclusive', @LockOwner = 'Transaction'", holder, lockTransaction))
                await take.ExecuteNonQueryAsync();
            using var posRequest = new HttpRequestMessage(HttpMethod.Post, "/api/orders/checkout") { Content = JsonContent.Create(posSale) };
            posRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            using var posBusy = await client.SendAsync(posRequest);
            Check(posBusy.StatusCode == HttpStatusCode.ServiceUnavailable && posBusy.Headers.RetryAfter != null,
                $"POS lock time-out returns 503 + Retry-After (got {(int)posBusy.StatusCode})");
            await lockTransaction.RollbackAsync();
        }
        var posPlaced = await Call(HttpMethod.Post, "/api/orders/checkout", posSale, adminToken);
        Check(posPlaced.GetProperty("id").GetInt32() > 0, "the POS sale goes through when retried with the same key");

        Console.WriteLine($"PASS: {assertions} cache freshness, live stock, payment ordering and busy-lock assertions.");

        static Task<List<CacheProbe>> Fail() => throw new Exception("Cache/busy regression failed: expected a RAM cache hit");

        async Task<decimal> ReadPriceAsync()
        {
            decimal price = 0;
            await Db(async db => price = await db.Products.AsNoTracking().Where(p => p.Id == productId).Select(p => p.Price).SingleAsync());
            return price;
        }

        async Task<Payment?> LatestPaymentAsync()
        {
            await using var scope = services.CreateAsyncScope();
            return await scope.ServiceProvider.GetRequiredService<PaymentRepository>().GetByOrderIdAsync(orderId);
        }

        async Task RawSqlAsync(string sql)
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();
            await using var command = new SqlCommand(sql, connection);
            await command.ExecuteNonQueryAsync();
        }

        async Task Db(Func<AppDbContext, Task> action)
        {
            await using var scope = services.CreateAsyncScope();
            await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
        }

        async Task<JsonElement> Call(HttpMethod method, string path, object? body = null, string? token = null)
        {
            using var request = new HttpRequestMessage(method, path);
            if (body != null) request.Content = JsonContent.Create(body);
            if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await client.SendAsync(request);
            var text = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new Exception($"Cache/busy regression failed: {method} {path} returned {(int)response.StatusCode}: {text}");
            return JsonDocument.Parse(text).RootElement.Clone();
        }
    }
}
