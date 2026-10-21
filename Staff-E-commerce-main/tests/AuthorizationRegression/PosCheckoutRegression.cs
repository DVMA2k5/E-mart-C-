using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.EntityFrameworkCore;

public static class PosCheckoutRegression
{
    public static async Task RunAsync(IServiceProvider services, HttpClient client, string token)
    {
        int assertions = 0, productId = 0, emptyId = 0, lastId = 0, customerId = 0;
        await Db(async db =>
        {
            var customer = new Customer { FullName = "POS buyer", Phone = "0999999999", RewardPoints = 30, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var product = Product("POS item", 10000, 20);
            var empty = Product("Empty item", 5000, 0);
            var last = Product("Last item", 7000, 1);
            db.Customers.Add(customer); db.Products.AddRange(product, empty, last);
            await db.SaveChangesAsync();
            (productId, emptyId, lastId, customerId) = (product.Id, empty.Id, last.Id, customer.Id);
        });

        var cash = Bill("cash", 2, 20000, points: 3);
        // Client-controlled price/status fields are ignored; duplicate lines are combined.
        var cashBody = JsonSerializer.SerializeToNode(cash, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        cashBody["subtotal"] = 1; cashBody["totalAmount"] = 1; cashBody["paymentStatus"] = "pending";
        var paid = await Send("/api/orders/checkout", cashBody);
        Check(paid.TotalAmount == 17000 && paid.Subtotal == 20000 && paid.ChangeDue == 3000, "Authoritative pricing and change");
        Check(paid.Status == "completed" && paid.PaymentStatus == "paid" && paid.PointsEarned == 1, "Cash settlement");
        var replay = await Send("/api/orders/checkout", cashBody);
        Check(replay.Id == paid.Id, "Retry uses same order");
        await Db(async db =>
        {
            Check((await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity == 18, "Stock debited once");
            Check((await db.Customers.FindAsync(customerId))!.RewardPoints == 28, "Points deducted and earned once");
            Check(await db.Payments.CountAsync(p => p.OrderId == paid.Id) == 1, "Single cash payment");
            Check(await db.Invoices.CountAsync(i => i.OrderId == paid.Id) == 1, "Single invoice");
            Check(await db.InvoiceItems.AnyAsync(i => i.Invoice!.OrderId == paid.Id && i.Quantity == 2), "Invoice has products");
            Check(await db.InventoryAdjustments.CountAsync(i => i.ProductId == productId) == 1, "Stock ledger recorded");
        });
        cash.Items[0].Quantity = 3;
        await Send("/api/orders/checkout", cash, HttpStatusCode.Conflict);
        await Send("/api/orders/checkout", Bill("cash", 1, 1), HttpStatusCode.BadRequest);
        var wrongQuote = Bill("cash", 1, 10000); wrongQuote.ExpectedTotal = 1;
        await Send("/api/orders/checkout", wrongQuote, HttpStatusCode.Conflict);
        var noCustomer = Bill("cash", 1, 10000, points: 1); noCustomer.CustomerId = null;
        await Send("/api/orders/checkout", noCustomer, HttpStatusCode.BadRequest);
        var invalid = Bill("cash", 1, 10000); invalid.Items[0].Quantity = -1;
        await Send("/api/orders/checkout", invalid, HttpStatusCode.BadRequest);
        await Send("/api/orders/create", new { orderNumber = "unsafe", status = "completed", subtotal = 1 }, HttpStatusCode.BadRequest);

        int count = 0, beforeStock = 0;
        await Db(async db => { count = await db.Orders.CountAsync(); beforeStock = (await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity; });
        var mixed = Bill("cash", 1, 100000); mixed.Items.Add(new PosCheckoutLine { ProductId = emptyId, Quantity = 1 });
        await Send("/api/orders/checkout", mixed, HttpStatusCode.Conflict);
        await Db(async db =>
        {
            Check(await db.Orders.CountAsync() == count, "Out-of-stock rolls back order");
            Check((await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity == beforeStock, "Out-of-stock rolls back other debits");
        });

        // Separate pending payment from a paid receipt.
        await Send("/api/orders/checkout", Bill("card", 1, null), HttpStatusCode.BadRequest);
        var card = await LegacyCard(5);
        Check(card.Status == "pending" && card.PaymentStatus == "pending" && card.PointsEarned == 0, "Card awaits confirmation");
        await Db(async db => Check(!await db.Invoices.AnyAsync(i => i.OrderId == card.Id), "Pending has no paid invoice"));
        await Send($"/api/orders/{card.Id}/complete", new { }, HttpStatusCode.Conflict);
        await Send($"/api/orders/{card.Id}/confirm", new { }, HttpStatusCode.Conflict);
        await Send($"/api/orders/{card.Id}/deliver", new { }, HttpStatusCode.Conflict);
        await Send($"/api/orders/{card.Id}/confirm-payment", new { amount = card.TotalAmount - 1, reference = "CARD-1" }, HttpStatusCode.BadRequest);
        await Send($"/api/orders/{card.Id}/confirm-payment", new { amount = card.TotalAmount, reference = "CARD-1" });
        await Send($"/api/orders/{card.Id}/confirm-payment", new { amount = card.TotalAmount, reference = "CARD-1" });
        await Db(async db => Check(await db.Payments.CountAsync(p => p.OrderId == card.Id) == 1, "Card confirmation idempotent"));
        var anotherCard = await LegacyCard();
        await Send($"/api/orders/{anotherCard.Id}/confirm-payment", new { amount = anotherCard.TotalAmount, reference = "CARD-1" }, HttpStatusCode.Conflict);
        await Send($"/api/orders/{anotherCard.Id}/confirm-payment", new { amount = anotherCard.TotalAmount, reference = " CARD-1 " }, HttpStatusCode.Conflict);

        // Cancelling a reserved bill restores stock and points exactly once.
        int beforePoints = 0;
        await Db(async db => { beforeStock = (await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity; beforePoints = (await db.Customers.FindAsync(customerId))!.RewardPoints; });
        var cancel = await Send("/api/orders/checkout", Bill("e_wallet", 1, null, points: 2));
        await Send($"/api/orders/{cancel.Id}/cancel", new { });
        await Send($"/api/orders/{cancel.Id}/cancel", new { });
        await Db(async db =>
        {
            Check((await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity == beforeStock, "Cancellation restores stock once");
            Check((await db.Customers.FindAsync(customerId))!.RewardPoints == beforePoints, "Cancellation restores points once");
        });
        await Send($"/api/orders/{cancel.Id}/confirm-payment", new { amount = cancel.TotalAmount, reference = "CANCELLED" }, HttpStatusCode.BadRequest);

        // A cancellation racing payment may win either way, but the ledger must match the winner.
        await Db(async db => { beforeStock = (await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity; beforePoints = (await db.Customers.FindAsync(customerId))!.RewardPoints; });
        var race = await LegacyCard(1);
        await Task.WhenAll(Raw($"/api/orders/{race.Id}/cancel", new { }), Raw($"/api/orders/{race.Id}/confirm-payment", new { amount = race.TotalAmount, reference = "RACE" }));
        await Db(async db =>
        {
            var winner = (await db.Orders.FindAsync(race.Id))!;
            var settled = winner.PaymentStatus == "paid";
            Check(winner.Status == (settled ? "completed" : "cancelled"), "Cancel/payment race has one final state");
            Check((await db.Inventory.SingleAsync(i => i.ProductId == productId)).Quantity == beforeStock - (settled ? 1 : 0), "Cancel/payment stock matches winner");
            Check((await db.Customers.FindAsync(customerId))!.RewardPoints == beforePoints - (settled ? 1 : 0), "Cancel/payment points match winner");
            Check(await db.Payments.CountAsync(p => p.OrderId == race.Id) == (settled ? 1 : 0), "Cancel/payment ledger matches winner");
        });

        // Expired and capped promotions, and automatic product prices.
        int expiredId = 0, cappedId = 0, discountProductId = 0;
        await Db(async db =>
        {
            var expired = Promotion("POS-EXPIRED"); expired.EndDate = DateTime.UtcNow.AddDays(-2);
            var capped = Promotion("POS-CAPPED"); capped.Value = 50; capped.MaxDiscount = 1000;
            var discounted = Product("Discounted", 20000, 5);
            var productPromo = Promotion("POS-PRODUCT"); productPromo.Type = "product"; productPromo.Value = 10;
            db.Promotions.AddRange(expired, capped, productPromo); db.Products.Add(discounted);
            await db.SaveChangesAsync();
            db.ProductPromotions.Add(new ProductPromotion { PromotionId = productPromo.Id, ProductId = discounted.Id });
            await db.SaveChangesAsync();
            (expiredId, cappedId, discountProductId) = (expired.Id, capped.Id, discounted.Id);
        });
        var expiredBill = Bill("cash", 1, 10000); expiredBill.PromotionId = expiredId;
        await Send("/api/orders/checkout", expiredBill, HttpStatusCode.BadRequest);
        var cappedBill = Bill("cash", 1, 10000); cappedBill.PromotionId = cappedId;
        Check((await Send("/api/orders/checkout", cappedBill)).TotalAmount == 9000, "Promotion cap applied");
        var autoDiscount = Bill("cash", 1, 20000); autoDiscount.Items[0].ProductId = discountProductId;
        Check((await Send("/api/orders/checkout", autoDiscount)).TotalAmount == 18000, "Product promotion applied server-side");

        // Concurrent checkout for the final unit: only one order can commit.
        var last1 = Bill("cash", 1, 7000); last1.CustomerId = null; last1.Items[0].ProductId = lastId;
        var last2 = Bill("cash", 1, 7000); last2.CustomerId = null; last2.Items[0].ProductId = lastId;
        var lastResults = await Task.WhenAll(Raw("/api/orders/checkout", last1), Raw("/api/orders/checkout", last2));
        Check(lastResults.Count(r => r.Status == HttpStatusCode.OK) == 1 && lastResults.Count(r => r.Status == HttpStatusCode.Conflict) == 1, "Final-unit concurrency");
        var retryBill = Bill("cash", 1, 10000);
        var retries = await Task.WhenAll(Raw("/api/orders/checkout", retryBill), Raw("/api/orders/checkout", retryBill));
        Check(retries.All(r => r.Status == HttpStatusCode.OK) && JsonSerializer.Deserialize<PosCheckoutResponse>(retries[0].Body, JsonOptions)!.Id == JsonSerializer.Deserialize<PosCheckoutResponse>(retries[1].Body, JsonOptions)!.Id, "Concurrent retry creates one order");

        // Signed payment callback must match the stored attempt and amount.
        var momo = await Send("/api/orders/checkout", Bill("e_wallet", 1, null));
        var reference = $"order_{momo.Id}_test";
        await Db(async db => { db.Payments.Add(new Payment { OrderId = momo.Id, Amount = momo.TotalAmount, Method = "other", Status = "pending", TransactionRef = reference, CreatedAt = DateTime.UtcNow }); await db.SaveChangesAsync(); });
        await Send($"/api/orders/{momo.Id}/confirm-payment", new { amount = momo.TotalAmount, reference }, HttpStatusCode.BadRequest);
        var badSignature = Callback(reference, (long)momo.TotalAmount); badSignature.Signature = "invalid";
        await Send("/api/payment/momo/ipn", badSignature, HttpStatusCode.BadRequest, anonymous: true);
        await Send("/api/payment/momo/ipn", Callback(reference, (long)momo.TotalAmount - 1), HttpStatusCode.BadRequest, anonymous: true);
        await Send("/api/payment/momo/ipn", Callback(reference, (long)momo.TotalAmount), anonymous: true);
        await Send("/api/payment/momo/ipn", Callback(reference, (long)momo.TotalAmount), anonymous: true);
        await Db(async db =>
        {
            Check((await db.Orders.FindAsync(momo.Id))!.PaymentStatus == "paid", "Signed callback settles POS");
            Check(await db.Payments.CountAsync(p => p.OrderId == momo.Id) == 1, "Callback reuses its payment attempt");
            Check(await db.Invoices.CountAsync(i => i.OrderId == momo.Id) == 1, "Callback invoice idempotent");
        });
        await Send("/api/payment/offlinepayment", new { orderId = anotherCard.Id, amount = 1, method = "cash" }, HttpStatusCode.BadRequest);
        await Send("/api/orderitem/create", new[] { new { orderId = paid.Id, productId, quantity = 100, unitPrice = 1, totalPrice = 100 } }, HttpStatusCode.BadRequest);
        // Repeating the same basket as a new sale must still create a separate order.
        var nextSale1 = await Send("/api/orders/checkout", Bill("cash", 1, 10000));
        var nextSale2 = await Send("/api/orders/checkout", Bill("cash", 1, 10000));
        Check(nextSale1.Id != nextSale2.Id, "Fresh request keys allow identical consecutive sales");
        Console.WriteLine($"PASS: {assertions} POS checkout/payment/stock assertions.");

        PosCheckoutRequest Bill(string method, int qty, decimal? cash, int points = 0) => new()
        { RequestId = Guid.NewGuid().ToString(), PaymentMethod = method, CashReceived = cash, CustomerId = customerId, PointsUsed = points, Items = [new() { ProductId = productId, Quantity = qty }] };
        // New sales only allow cash/MoMo; retain lifecycle coverage for pre-existing card orders.
        async Task<PosCheckoutResponse> LegacyCard(int points = 0)
        {
            var order = await Send("/api/orders/checkout", Bill("e_wallet", 1, null, points));
            await Db(async db => await db.Orders.Where(o => o.Id == order.Id)
                .ExecuteUpdateAsync(u => u.SetProperty(o => o.PaymentMethod, "card")));
            order.PaymentMethod = "card";
            return order;
        }
        async Task Db(Func<AppDbContext, Task> action) { await using var scope = services.CreateAsyncScope(); await action(scope.ServiceProvider.GetRequiredService<AppDbContext>()); }
        void Check(bool valid, string message) { if (!valid) throw new Exception(message); assertions++; }
        async Task<(HttpStatusCode Status, string Body)> Raw(string path, object body, bool anonymous = false)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
            if (!anonymous) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await client.SendAsync(request);
            return (response.StatusCode, await response.Content.ReadAsStringAsync());
        }
        async Task<PosCheckoutResponse> Send(string path, object body, HttpStatusCode expected = HttpStatusCode.OK, bool anonymous = false)
        {
            var result = await Raw(path, body, anonymous);
            Check(result.Status == expected, $"{path}: expected {expected}, got {result.Status}: {result.Body}");
            return expected == HttpStatusCode.OK && result.Body.StartsWith('{') ? JsonSerializer.Deserialize<PosCheckoutResponse>(result.Body, JsonOptions)! : new();
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static Product Product(string name, decimal price, int stock) => new() { ProductName = name, Price = price, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Inventory = new Inventory { Quantity = stock, UpdatedAt = DateTime.UtcNow } };
    private static Promotion Promotion(string code) => new() { Code = code, Name = code, Type = "event", Status = "active", DiscountType = "percent", Value = 10, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
    private static MomoIpnCallbackDTO Callback(string reference, long amount)
    {
        var data = new MomoIpnCallbackDTO { OrderId = reference, Amount = amount, ResultCode = 0, PartnerCode = "test", RequestId = "test-request", TransId = 1, Message = "ok", OrderInfo = "POS", OrderType = "momo_wallet", PayType = "qr", ResponseTime = 1, ExtraData = "" };
        var raw = $"accessKey=test-access&amount={data.Amount}&extraData={data.ExtraData}&message={data.Message}&orderId={data.OrderId}&orderInfo={data.OrderInfo}&orderType={data.OrderType}&partnerCode={data.PartnerCode}&payType={data.PayType}&requestId={data.RequestId}&responseTime={data.ResponseTime}&resultCode={data.ResultCode}&transId={data.TransId}";
        data.Signature = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes("test-secret"), Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
        return data;
    }
}
