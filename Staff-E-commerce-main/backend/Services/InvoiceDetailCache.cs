using backend.DTO;

namespace backend.Services;

/// <summary>Short-lived BUS cache for recently viewed invoice details.</summary>
public sealed class InvoiceDetailCache(ILogger<InvoiceDetailCache> logger)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(12);
    private const int MaxEntries = 200;
    private readonly object _sync = new();
    private readonly SemaphoreSlim _loadGate = new(1, 1);
    private readonly Dictionary<int, (InvoiceDTO Detail, DateTimeOffset LoadedAt)> _items = new();
    private long _generation;

    public async Task<InvoiceDTO?> GetOrCreateAsync(int invoiceId, Func<Task<InvoiceDTO?>> load)
    {
        if (TryGet(invoiceId, out var detail))
        {
            logger.LogInformation("Invoice detail {InvoiceId}: RAM cache", invoiceId);
            return detail;
        }

        await _loadGate.WaitAsync();
        try
        {
            while (true)
            {
                if (TryGet(invoiceId, out detail))
                {
                    logger.LogInformation("Invoice detail {InvoiceId}: RAM cache", invoiceId);
                    return detail;
                }

                long generation;
                lock (_sync) generation = _generation;
                detail = await load();
                lock (_sync)
                {
                    // A completed mutation invalidates a read that was in flight.
                    if (generation != _generation) continue;
                    if (detail is not null)
                    {
                        var now = DateTimeOffset.UtcNow;
                        foreach (var expired in _items.Where(item => now - item.Value.LoadedAt >= Ttl).Select(item => item.Key).ToList())
                            _items.Remove(expired);
                        if (_items.Count >= MaxEntries)
                            _items.Remove(_items.MinBy(item => item.Value.LoadedAt).Key);
                        _items[invoiceId] = (detail, now);
                    }
                    logger.LogInformation("Invoice detail {InvoiceId}: database", invoiceId);
                    return detail;
                }
            }
        }
        finally
        {
            _loadGate.Release();
        }
    }

    private bool TryGet(int invoiceId, out InvoiceDTO? detail)
    {
        lock (_sync)
        {
            if (_items.TryGetValue(invoiceId, out var entry))
            {
                if (DateTimeOffset.UtcNow - entry.LoadedAt < Ttl)
                {
                    detail = entry.Detail;
                    return true;
                }
                _items.Remove(invoiceId);
            }
        }
        detail = null;
        return false;
    }

    public void Clear()
    {
        lock (_sync)
        {
            _generation++;
            _items.Clear();
        }
    }
}
