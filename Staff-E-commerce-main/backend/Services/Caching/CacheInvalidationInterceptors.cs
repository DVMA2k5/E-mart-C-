using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace backend.Services.Caching;

// EF Core interceptors that fire the cache signal only after data is really committed.
// A write inside an explicit transaction is remembered and published on COMMIT (never before, so a concurrent
// read cannot re-cache the old rows). A rolled-back transaction publishes nothing.

/// <summary>SaveChanges / SaveChangesAsync.</summary>
public sealed class CacheInvalidationSaveChangesInterceptor(CacheInvalidationSignal signal) : SaveChangesInterceptor
{
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        Publish(eventData.Context, result);
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        Publish(eventData.Context, result);
        return ValueTask.FromResult(result);
    }

    private void Publish(DbContext? context, int affectedRows)
    {
        if (affectedRows <= 0 || context == null) return;
        var transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        if (transaction == null) signal.Invalidate();
        else signal.MarkDirty(transaction);
    }
}

/// <summary>ExecuteUpdate / ExecuteDelete / ExecuteSql (stock changes use these).</summary>
public sealed class CacheInvalidationCommandInterceptor(CacheInvalidationSignal signal) : DbCommandInterceptor
{
    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        Publish(command);
        return result;
    }

    public override ValueTask<int> NonQueryExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        Publish(command);
        return ValueTask.FromResult(result);
    }

    private void Publish(DbCommand command)
    {
        if (command.Transaction == null) signal.Invalidate();
        else signal.MarkDirty(command.Transaction);
    }
}

/// <summary>Publishes the writes of a transaction once it has committed.</summary>
public sealed class CacheInvalidationTransactionInterceptor(CacheInvalidationSignal signal) : DbTransactionInterceptor
{
    public override void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData)
    {
        if (signal.Complete(transaction)) signal.Invalidate();
    }

    public override Task TransactionCommittedAsync(
        DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        if (signal.Complete(transaction)) signal.Invalidate();
        return Task.CompletedTask;
    }

    public override void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) =>
        signal.Complete(transaction);

    public override Task TransactionRolledBackAsync(
        DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        signal.Complete(transaction);
        return Task.CompletedTask;
    }
}
