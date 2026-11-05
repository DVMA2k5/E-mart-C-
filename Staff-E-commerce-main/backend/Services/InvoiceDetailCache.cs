using backend.DTO;
using backend.Services.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;

namespace backend.Services;

/// <summary>Short-lived BUS cache for recently viewed invoice details (one size unit per invoice).</summary>
public sealed class InvoiceDetailCache(
    BusCacheStore store,
    CacheInvalidationSignal signal,
    ILogger<InvoiceDetailCache> logger)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(12);
    private CancellationTokenSource _local = new();

    private static string Key(int invoiceId) => $"invoice-detail:{invoiceId}";

    public async Task<InvoiceDTO?> GetOrCreateAsync(int invoiceId, Func<Task<InvoiceDTO?>> load)
    {
        if (store.Cache.TryGetValue(Key(invoiceId), out InvoiceDTO? cached) && cached is not null)
        {
            logger.LogInformation("Invoice detail {InvoiceId}: RAM cache", invoiceId);
            return cached;
        }

        var global = signal.Current;
        var local = new CancellationChangeToken(Volatile.Read(ref _local).Token);
        var detail = await load();
        if (detail is not null && !global.HasChanged && !local.HasChanged)
        {
            store.Cache.Set(Key(invoiceId), detail, new MemoryCacheEntryOptions
            {
                Size = 1,
                SlidingExpiration = TimeSpan.FromMinutes(4),
                AbsoluteExpirationRelativeToNow = Ttl,
                Priority = CacheItemPriority.Low
            }.AddExpirationToken(global).AddExpirationToken(local));
        }
        logger.LogInformation("Invoice detail {InvoiceId}: database", invoiceId);
        return detail;
    }

    public void Clear() => Interlocked.Exchange(ref _local, new CancellationTokenSource()).Cancel();
}
