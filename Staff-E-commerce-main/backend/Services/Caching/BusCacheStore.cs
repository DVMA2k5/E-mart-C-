using Microsoft.Extensions.Caching.Memory;

namespace backend.Services.Caching;

/// <summary>
/// The one bounded MemoryCache used by the BUS read caches. It is separate from the framework's shared
/// IMemoryCache because a size-limited cache requires every entry to declare a size.
///
/// Size unit = one cached row (a list of 500 products costs 500). When the budget is exceeded MemoryCache compacts
/// itself, evicting low-priority and oldest entries first. Expired entries are swept lazily during cache access;
/// there is no timer or background loop.
/// </summary>
public sealed class BusCacheStore : IDisposable
{
    public BusCacheStore(IConfiguration configuration)
    {
        Cache = new MemoryCache(new MemoryCacheOptions
        {
            SizeLimit = Math.Max(1_000, configuration.GetValue<long?>("Cache:SizeLimit") ?? 100_000),
            CompactionPercentage = 0.25,
            ExpirationScanFrequency = TimeSpan.FromMinutes(5)
        });
    }

    public MemoryCache Cache { get; }

    public void Dispose() => Cache.Dispose();
}
