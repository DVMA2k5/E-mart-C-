using System.Diagnostics;
using backend.Services.Caching;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Services;

/// <summary>
/// List cache used by the BUS classes, backed by the size-limited <see cref="BusCacheStore"/> (ASP.NET Core
/// MemoryCache). Freshness rules:
/// <list type="bullet">
/// <item>Each entry is tied to the change token that was current when its database read began, so a commit
/// anywhere in the system evicts it (see <see cref="CacheInvalidationSignal"/>).</item>
/// <item>Write helpers never patch cached objects in place; they drop the entry and the next read reloads it.</item>
/// <item>The entry also has an absolute TTL as a safety net for clock-based changes (promotions starting).</item>
/// </list>
/// </summary>
public sealed class BusMemoryCache<T>(
    BusCacheStore store,
    CacheInvalidationSignal signal,
    ILogger<BusMemoryCache<T>> logger)
{
    private const int MaxReloadAttempts = 3;
    private static readonly string Key = $"bus-list:{typeof(T).FullName}";
    private readonly SemaphoreSlim _loadGate = new(1, 1);

    public async Task<(IReadOnlyList<T> Items, bool LoadedFromDatabase)> GetOrCreateAsync(
        Func<Task<List<T>>> factory,
        TimeSpan ttl)
    {
        var stopwatch = Stopwatch.StartNew();
        var beforeMemory = GC.GetTotalMemory(false);
        if (TryGet(out var cached))
        {
            LogMeasurement("RAM Cache", stopwatch, beforeMemory);
            return (cached, false);
        }

        // One loader per list: concurrent misses wait for the first load instead of all hitting SQL.
        await _loadGate.WaitAsync();
        try
        {
            if (TryGet(out cached))
            {
                LogMeasurement("RAM Cache", stopwatch, beforeMemory);
                return (cached, false);
            }

            for (var attempt = 1; ; attempt++)
            {
                var token = signal.Current; // captured BEFORE reading, see CacheInvalidationSignal
                var loaded = await factory();
                if (token.HasChanged && attempt < MaxReloadAttempts) continue; // a commit landed mid-read

                var options = new MemoryCacheEntryOptions
                {
                    Size = Math.Max(1, loaded.Count),
                    AbsoluteExpirationRelativeToNow = ttl,
                    Priority = CacheItemPriority.Normal
                }.AddExpirationToken(token);
                store.Cache.Set(Key, loaded, options); // ignored by MemoryCache if the token already fired
                LogMeasurement("Database", stopwatch, beforeMemory);
                return (loaded, true);
            }
        }
        finally
        {
            _loadGate.Release();
        }
    }

    private bool TryGet(out IReadOnlyList<T> items)
    {
        if (store.Cache.TryGetValue(Key, out List<T>? value) && value is not null)
        {
            items = value;
            return true;
        }
        items = Array.Empty<T>();
        return false;
    }

    private void LogMeasurement(string source, Stopwatch stopwatch, long beforeMemory)
    {
        stopwatch.Stop();
        var memoryMb = Math.Max(0, GC.GetTotalMemory(false) - beforeMemory) / 1024d / 1024d;
        logger.LogInformation(
            "[BUS Cache] Type: {CacheType} | Nguồn: {Source} | Thời gian: {ElapsedMs} ms | Bộ nhớ: {MemoryMb:F3} MB",
            typeof(T).Name,
            source,
            stopwatch.Elapsed.TotalMilliseconds,
            memoryMb);
    }

    /// <summary>Drops this list; the next read reloads it from the database.</summary>
    public void Clear() => store.Cache.Remove(Key);

    // The helpers below keep their old signatures for the services, but no longer edit cached objects in place.
    // Editing shared objects raced with readers and could leave uncommitted values cached after a rollback.
    public void Replace(IEnumerable<T> items) => Clear();
    public void AddOrUpdate(T item, Func<T, object> keySelector) => Clear();
    public bool RemoveWhere(Func<T, bool> predicate) { Clear(); return true; }
    public void UpdateWhere(Func<T, bool> predicate, Func<T, T> updater) => Clear();
}
