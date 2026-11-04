using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using backend.Data;
using backend.DTO;
using backend.Helpers;
using backend.Models;
using backend.Services;
using Microsoft.EntityFrameworkCore;

public static class VoucherWalletRegression
{
    public static async Task SeedLegacyAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var customer = new Customer { FullName = "Legacy voucher owner", Phone = "0987654399", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        Promotion Legacy(string code) => new() { Code = code, Name = code, Type = "voucher", Value = 10, DiscountType = "percent",
            Status = "active", UsageLimit = 5, UsedCount = 2, StartDate = DateTimeHelper.VietnamToday.AddDays(-1), EndDate = DateTimeHelper.VietnamToday.AddDays(10),
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, VoucherDetails = new() { VoucherCode = code } };
        var used = Legacy("LEGACY-USED-V1"); var pending = Legacy("LEGACY-PENDING-V1");
        db.Customers.Add(customer); db.Promotions.AddRange(used, pending); await db.SaveChangesAsync();
        for (var i = 0; i < 3; i++)
        {
            var order = new Order { OrderNumber = "LEGACY-VOUCHER-" + i, OrderType = "mobile", CustomerId = customer.Id,
                PromotionId = i == 2 ? pending.Id : used.Id, Status = i == 0 ? "completed" : "pending",
                PaymentStatus = i == 0 ? "paid" : "pending", PaymentMethod = "cash", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Orders.Add(order); await db.SaveChangesAsync();
            db.PromotionRedemptions.Add(new() { PromotionId = order.PromotionId!.Value, CustomerId = customer.Id, OrderId = order.Id, RedeemedAt = DateTime.UtcNow });
        }
        await db.SaveChangesAsync();
    }

    public static async Task RunAsync(IServiceProvider services, HttpClient client, string adminToken)
    {
        var assertions = 0;
        var today = DateTimeHelper.VietnamToday;
        var buyers = new List<(int Id, string Token)>();
        var productId = 0;
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var legacy = await db.CustomerVouchers.Include(v => v.Promotion).ThenInclude(p => p.VoucherDetails)
                .Where(v => v.Source == "legacy").ToListAsync();
            if (legacy.Count == 0) return; // The full suite may start from a fresh schema without legacy fixtures.
            var used = legacy.Single(v => v.Promotion.Name == "LEGACY-USED-V1");
            var pending = legacy.Single(v => v.Promotion.Name == "LEGACY-PENDING-V1");
            Check(used.UsedAt.HasValue && used.Promotion.UsedCount == 1, "Legacy duplicate uses become one consumed ownership");
            Check(!pending.UsedAt.HasValue && pending.OrderId.HasValue && pending.Promotion.UsedCount == 0, "Legacy pending use becomes an unconsumed reservation");
            Check(used.Promotion.VoucherDetails!.ClaimedCount == 1 && used.Promotion.VoucherDetails.ClaimLimit == 5, "Legacy usage cap migrates separately from claims");
            Check(!await db.PromotionRedemptions.Include(r => r.Order).AnyAsync(r => r.PromotionId == pending.PromotionId), "Pending legacy redemption is not counted as successful use");
        });
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.Roles.SingleAsync(r => r.Name == "customer");
            for (var i = 1; i <= 3; i++)
            {
                var user = new User { Username = "098765430" + i, FullName = "Voucher buyer " + i, // username = phone, as for every customer
                    PasswordHash = "fixture", RoleEntity = role, IsActive = true, CreatedAt = DateTime.UtcNow,
                    Customer = new Customer { FullName = "Voucher buyer " + i, Phone = "098765430" + i,
                        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow } };
                db.Users.Add(user);
                await db.SaveChangesAsync();
                buyers.Add((user.Customer.Id, scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(user).token));
            }
            var product = new Product { ProductName = "Voucher fixture", Price = 20000, StockQuantity = 100,
                IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            db.Products.Add(product); await db.SaveChangesAsync(); productId = product.Id;
        });
        var a = buyers[0]; var b = buyers[1]; var c = buyers[2];
        await Call(HttpMethod.Get, "/api/storefront/vouchers", null, expected: HttpStatusCode.Unauthorized);
        await Call(HttpMethod.Get, "/api/promotions", a.Token, expected: HttpStatusCode.Forbidden);

        var publicVoucher = await Create("PUBLIC-V1", "public", 10);
        var secret = await Create("SECRET-V1", "only-code", 1);
        Check((await Wallet(a)).GetArrayLength() == 0, "Unsent voucher is not owned automatically");
        var discover = await Call(HttpMethod.Get, "/api/storefront/vouchers/discover", a.Token);
        Check(Contains(discover, publicVoucher.Id) && !Contains(discover, secret.Id), "Only Public appears in discovery");
        var publicFeed = await Call(HttpMethod.Get, "/api/storefront/promotions", null);
        Check(!Contains(publicFeed, secret.Id), "Anonymous feed never exposes Only-code");
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", a.Token, new { promotionId = secret.Id }, HttpStatusCode.NotFound);
        await Claim(a, new { code = "  secret-v1  " });
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", a.Token, new { code = "SECRET-V1" }, HttpStatusCode.Conflict);
        var full = await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", b.Token, new { code = "SECRET-V1" }, HttpStatusCode.Conflict);
        Check(full.GetProperty("message").GetString() == "Mã đã hết lượt", "Claim cap applies before any use");
        var secretStats = await Call(HttpMethod.Get, $"/api/promotions/{secret.Id}", adminToken);
        Check(secretStats.GetProperty("claimedCount").GetInt32() == 1 && secretStats.GetProperty("usedCount").GetInt32() == 0, "Claims and completed uses are distinct");
        var valid = await Call(HttpMethod.Post, "/api/storefront/promotions/validate", a.Token, new { code = "SECRET-V1", orderAmount = 20000 });
        Check(valid.GetProperty("isValid").GetBoolean(), "Owner can use when claim capacity is exhausted");
        valid = await Call(HttpMethod.Post, "/api/storefront/promotions/validate", b.Token, new { code = "SECRET-V1", orderAmount = 20000 });
        Check(!valid.GetProperty("isValid").GetBoolean(), "Another customer cannot use an unowned code");
        await Call(HttpMethod.Post, "/api/storefront/orders", b.Token, Bill("SECRET-V1"), HttpStatusCode.BadRequest);

        var bill = Bill("SECRET-V1");
        var order = await Call(HttpMethod.Post, "/api/storefront/orders", a.Token, bill);
        var orderId = order.GetProperty("id").GetInt32();
        var replay = await Call(HttpMethod.Post, "/api/storefront/orders", a.Token, bill);
        Check(replay.GetProperty("id").GetInt32() == orderId, "Checkout retry reserves once");
        Check(Status(await Wallet(a), secret.Id) == "reserved", "Pending order reserves the voucher");
        await Call(HttpMethod.Post, "/api/storefront/orders", a.Token, Bill("SECRET-V1"), HttpStatusCode.Conflict);
        await Call(HttpMethod.Post, $"/api/orders/{orderId}/reject", adminToken, new { reason = "Fixture cancellation" });
        Check(Status(await Wallet(a), secret.Id) == "available", "Cancellation restores the same owned voucher");
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", a.Token, new { code = "SECRET-V1" }, HttpStatusCode.Conflict);
        order = await Call(HttpMethod.Post, "/api/storefront/orders", a.Token, Bill("SECRET-V1"));
        orderId = order.GetProperty("id").GetInt32();
        await Call(HttpMethod.Post, $"/api/orders/{orderId}/confirm", adminToken, new { });
        await Call(HttpMethod.Post, $"/api/orders/{orderId}/deliver", adminToken, new { });
        await Call(HttpMethod.Post, $"/api/orders/{orderId}/deliver", adminToken, new { });
        await Call(HttpMethod.Post, "/api/promotions/apply", adminToken, new { promotionId = secret.Id, orderId, customerId = a.Id });
        Check(Status(await Wallet(a), secret.Id) == "used", "Completion moves voucher to used history");
        await Call(HttpMethod.Post, "/api/storefront/orders", a.Token, Bill("SECRET-V1"), HttpStatusCode.Conflict);
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Promotions.FindAsync(secret.Id))!.EndDate = today.AddDays(-1); await db.SaveChangesAsync();
        });
        Check(Status(await Wallet(a), secret.Id) == "used", "Used voucher remains used after its expiry");
        var history = await Call(HttpMethod.Get, "/api/storefront/promotions/history", a.Token);
        Check(history.EnumerateArray().Any(v => v.GetProperty("id").GetInt32() == secret.Id && v.GetProperty("walletStatus").GetString() == "used"), "Used history returns owned used voucher");
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Check(await db.PromotionRedemptions.CountAsync(r => r.PromotionId == secret.Id) == 1, "Exactly one successful redemption");
            Check((await db.Promotions.FindAsync(secret.Id))!.UsedCount == 1, "Completed count increments exactly once");
        });

        var race = await Create("RACE-V1", "public", 1);
        var attempts = await Task.WhenAll(RawClaim(a, race.Id), RawClaim(b, race.Id));
        Check(attempts.Count(status => status == HttpStatusCode.OK) == 1 && attempts.Count(status => status == HttpStatusCode.Conflict) == 1, "Concurrent buyers cannot exceed claim limit");
        attempts = await Task.WhenAll(RawClaim(c, publicVoucher.Id), RawClaim(c, publicVoucher.Id));
        Check(attempts.Count(status => status == HttpStatusCode.OK) == 1 && attempts.Count(status => status == HttpStatusCode.Conflict) == 1, "Concurrent duplicate claims create one ownership record");

        var expires = await Create("EXPIRES-V1", "only-code", 5);
        await Claim(a, new { code = "EXPIRES-V1" });
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Promotions.FindAsync(expires.Id))!.EndDate = today.AddDays(-1); await db.SaveChangesAsync();
        });
        Check(Status(await Wallet(a), expires.Id) == "expired", "Unused ownership moves to expired");
        history = await Call(HttpMethod.Get, "/api/storefront/promotions/history", a.Token);
        Check(Contains(history, expires.Id) && Status(history, secret.Id) == "used", "Used voucher stays used after other vouchers expire");
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", b.Token, new { code = "EXPIRES-V1" }, HttpStatusCode.Conflict);

        var disabled = await Create("DISABLED-V1", "only-code", 5);
        await Claim(a, new { code = "DISABLED-V1" });
        await Call(HttpMethod.Patch, $"/api/promotions/{disabled.Id}/toggle", adminToken, expected: HttpStatusCode.NoContent);
        Check(Status(await Wallet(a), disabled.Id) == "disabled", "Disabled owned voucher cannot be used");
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", b.Token, new { code = "DISABLED-V1" }, HttpStatusCode.Conflict);
        var future = Config("FUTURE-V1", "only-code", 10); future.StartDate = future.ClaimStartDate = today.AddDays(1);
        await Call(HttpMethod.Post, "/api/promotions", adminToken, future, HttpStatusCode.Created);
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", b.Token, new { code = "FUTURE-V1" }, HttpStatusCode.Conflict);
        var closed = Config("CLOSED-V1", "only-code", 10); closed.StartDate = closed.ClaimStartDate = today.AddDays(-2); closed.ClaimEndDate = today.AddDays(-1);
        await Call(HttpMethod.Post, "/api/promotions", adminToken, closed, HttpStatusCode.Created);
        await Call(HttpMethod.Post, "/api/storefront/vouchers/claim", b.Token, new { code = "CLOSED-V1" }, HttpStatusCode.Conflict);
        var invalidDates = Config("BAD-DATES-V1", "public", 5); invalidDates.ClaimEndDate = invalidDates.EndDate!.Value.AddDays(1);
        await Call(HttpMethod.Post, "/api/promotions", adminToken, invalidDates, HttpStatusCode.BadRequest);

        var autoTooSmall = Config("AUTO-SMALL-V1", "public", 1); autoTooSmall.SendToCustomers = true;
        await Call(HttpMethod.Post, "/api/promotions", adminToken, autoTooSmall, HttpStatusCode.BadRequest);
        await Scope(async scope => Check(!await scope.ServiceProvider.GetRequiredService<AppDbContext>().VoucherPromotions.AnyAsync(v => v.VoucherCode == "AUTO-SMALL-V1"), "Insufficient auto-grant capacity rolls back creation"));
        var auto = Config("AUTO-V1", "public", 100); auto.SendToCustomers = true;
        var granted = (await Call(HttpMethod.Post, "/api/promotions", adminToken, auto, HttpStatusCode.Created)).GetProperty("id").GetInt32();
        Check(Contains(await Wallet(a), granted) && Contains(await Wallet(b), granted), "Sent to customer grants ownership to existing customers");
        var edit = await Call(HttpMethod.Get, $"/api/promotions/{granted}", adminToken);
        var editDto = edit.Deserialize<PromotionDTO>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        editDto.ClaimLimit = 1;
        await Call(HttpMethod.Put, $"/api/promotions/{granted}", adminToken, editDto, HttpStatusCode.BadRequest);
        editDto.ClaimLimit = 100; editDto.Description = "Updated description";
        await Call(HttpMethod.Put, $"/api/promotions/{granted}", adminToken, editDto);
        Check(Contains(await Wallet(a), granted), "Editing does not lose ownership or send again");

        // POS follows the same ownership and one-use rule as mobile checkout.
        await Call(HttpMethod.Post, "/api/orders/checkout", adminToken, new PosCheckoutRequest { RequestId = Guid.NewGuid().ToString(),
            CustomerId = b.Id, PromotionId = publicVoucher.Id, CashReceived = 20000, Items = [new() { ProductId = productId, Quantity = 1 }] }, HttpStatusCode.BadRequest);
        await Claim(b, new { promotionId = publicVoucher.Id });
        await Call(HttpMethod.Post, "/api/orders/checkout", adminToken, new PosCheckoutRequest { RequestId = Guid.NewGuid().ToString(),
            CustomerId = b.Id, PromotionId = publicVoucher.Id, CashReceived = 20000, Items = [new() { ProductId = productId, Quantity = 1 }] });
        Check(Status(await Wallet(b), publicVoucher.Id) == "used", "Cash POS completes the owned voucher");

        var reservedExpiry = await Create("RESERVED-EXPIRY-V1", "only-code", 5);
        await Claim(c, new { code = "RESERVED-EXPIRY-V1" });
        var expiringOrder = await Call(HttpMethod.Post, "/api/storefront/orders", c.Token, Bill("RESERVED-EXPIRY-V1"));
        await Scope(async scope =>
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Promotions.FindAsync(reservedExpiry.Id))!.EndDate = today.AddDays(-1); await db.SaveChangesAsync();
        });
        Check(Status(await Wallet(c), reservedExpiry.Id) == "expired", "An unused reserved voucher also appears in expired history");
        await Call(HttpMethod.Post, $"/api/orders/{expiringOrder.GetProperty("id").GetInt32()}/reject", adminToken, new { reason = "Expiry fixture" });
        Check(Status(await Wallet(c), reservedExpiry.Id) == "expired", "Cancellation does not revive an expired voucher");

        await AuthorizationSchemaInitializer.InitializeAsync(services);
        Check(Status(await Wallet(a), secret.Id) == "used", "Restart migration preserves wallet and used status");
        Console.WriteLine($"PASS: {assertions} voucher ownership, claim-cap, concurrency, checkout and lifecycle assertions.");

        PromotionDTO Config(string code, string visibility, int limit) => new() { Name = code, Type = "voucher", VoucherCode = code,
            Visibility = visibility, Value = 1000, DiscountType = "fixed", StartDate = today, EndDate = today.AddDays(10),
            ClaimStartDate = today, ClaimEndDate = today.AddDays(5), ClaimLimit = limit, Active = true, Status = "active" };
        async Task<PromotionDTO> Create(string code, string visibility, int limit) => (await Call(HttpMethod.Post, "/api/promotions", adminToken,
            Config(code, visibility, limit), HttpStatusCode.Created)).Deserialize<PromotionDTO>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        object Bill(string code) => new { requestId = Guid.NewGuid().ToString(), fullName = "Voucher buyer", phone = "0987654301",
            address = "123 Voucher Street", paymentMethod = "cod", promotionCode = code, items = new[] { new { productId, quantity = 1 } } };
        Task<JsonElement> Wallet((int Id, string Token) buyer) => Call(HttpMethod.Get, "/api/storefront/vouchers", buyer.Token);
        Task<JsonElement> Claim((int Id, string Token) buyer, object body) => Call(HttpMethod.Post, "/api/storefront/vouchers/claim", buyer.Token, body);
        bool Contains(JsonElement items, int id) => items.EnumerateArray().Any(v => v.GetProperty("id").GetInt32() == id);
        string? Status(JsonElement items, int id) => items.EnumerateArray().Single(v => v.GetProperty("id").GetInt32() == id).GetProperty("walletStatus").GetString();
        async Task<HttpStatusCode> RawClaim((int Id, string Token) buyer, int id)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/storefront/vouchers/claim") { Content = JsonContent.Create(new { promotionId = id }) };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyer.Token);
            using var response = await client.SendAsync(request); return response.StatusCode;
        }
        async Task<JsonElement> Call(HttpMethod method, string path, string? token, object? body = null, HttpStatusCode expected = HttpStatusCode.OK)
        {
            using var request = new HttpRequestMessage(method, path);
            if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body != null) request.Content = JsonContent.Create(body);
            using var response = await client.SendAsync(request);
            var result = await response.Content.ReadAsStringAsync();
            Check(response.StatusCode == expected, $"{method} {path}: expected {(int)expected}, got {(int)response.StatusCode}: {result}");
            if (string.IsNullOrWhiteSpace(result)) return default;
            try { return JsonDocument.Parse(result).RootElement.Clone(); }
            catch (JsonException) { return JsonSerializer.SerializeToElement(new { message = result }); }
        }
        async Task Scope(Func<AsyncServiceScope, Task> action) { await using var scope = services.CreateAsyncScope(); await action(scope); }
        void Check(bool condition, string message) { if (!condition) throw new Exception(message); assertions++; }
    }
}
