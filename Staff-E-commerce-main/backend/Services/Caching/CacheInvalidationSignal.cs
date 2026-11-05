using System.Data.Common;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.Primitives;

namespace backend.Services.Caching;

/// <summary>
/// One "data changed" signal shared by every BUS read cache.
///
/// Each cached entry carries the <see cref="IChangeToken"/> that was current when its database read STARTED.
/// When a write is committed, <see cref="Invalidate"/> cancels that token, so every entry built from older data
/// is evicted at once. An entry whose read overlapped the commit already carries a cancelled token, and
/// MemoryCache refuses to store an entry whose token has fired, so stale data can never be cached.
///
/// Nothing here runs in the background: the cache is idle until a request reads it or a commit fires the token.
/// </summary>
public sealed class CacheInvalidationSignal
{
    private CancellationTokenSource _source = new();

    // Transactions that wrote something. The entry disappears with the transaction object (no leak).
    private readonly ConditionalWeakTable<DbTransaction, object> _dirtyTransactions = new();
    private static readonly object Marker = new();

    public IChangeToken Current => new CancellationChangeToken(Volatile.Read(ref _source).Token);

    /// <summary>Evicts every cached read. Cheap: one token swap; MemoryCache drops the entries itself.</summary>
    public void Invalidate()
    {
        var previous = Interlocked.Exchange(ref _source, new CancellationTokenSource());
        // Not disposed on purpose: readers may still hold its token, and a source without a timer owns no
        // unmanaged resources, so the garbage collector reclaims it.
        previous.Cancel();
    }

    internal void MarkDirty(DbTransaction transaction) => _dirtyTransactions.AddOrUpdate(transaction, Marker);

    /// <summary>Called when a transaction ends. Returns true when it had written data.</summary>
    internal bool Complete(DbTransaction transaction) => _dirtyTransactions.Remove(transaction);
}
