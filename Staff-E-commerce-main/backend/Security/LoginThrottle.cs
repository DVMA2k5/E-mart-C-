using System.Collections.Concurrent;

namespace backend.Security;

/// <summary>
/// In-memory brute-force guard for the two login endpoints. After too many wrong passwords for one account (or from
/// one IP address) inside the window, further attempts are refused for a short lock-out, even with the right password.
/// </summary>
public sealed class LoginThrottle
{
    private const int MaxFailuresPerAccount = 5;
    private const int MaxFailuresPerIp = 30;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan LockOut = TimeSpan.FromMinutes(5);

    private sealed class Entry
    {
        public int Failures;
        public DateTime WindowStart;
        public DateTime? LockedUntil;
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new();

    private static string AccountKey(string scope, string username) => $"{scope}:user:{username.Trim().ToLowerInvariant()}";
    private static string IpKey(string scope, string? ip) => $"{scope}:ip:{ip ?? "unknown"}";

    /// <summary>Remaining lock-out time, or null when the attempt may proceed.</summary>
    public TimeSpan? RetryAfter(string scope, string username, string? ip)
    {
        var now = DateTime.UtcNow;
        TimeSpan? Remaining(string key) =>
            _entries.TryGetValue(key, out var entry) && entry.LockedUntil > now ? entry.LockedUntil - now : null;
        return Remaining(AccountKey(scope, username)) ?? Remaining(IpKey(scope, ip));
    }

    public void RegisterFailure(string scope, string username, string? ip, int accountLimit = MaxFailuresPerAccount)
    {
        Register(AccountKey(scope, username), accountLimit);
        Register(IpKey(scope, ip), MaxFailuresPerIp);
        if (_entries.Count > 50_000) Prune();
    }

    public void RegisterSuccess(string scope, string username) => _entries.TryRemove(AccountKey(scope, username), out _);

    public static string Message(TimeSpan retryAfter) =>
        $"Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau {Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes))} phút.";

    private void Register(string key, int limit)
    {
        var now = DateTime.UtcNow;
        var entry = _entries.GetOrAdd(key, _ => new Entry { WindowStart = now });
        lock (entry)
        {
            var lockExpired = entry.LockedUntil.HasValue && entry.LockedUntil <= now;
            var windowExpired = !entry.LockedUntil.HasValue && now - entry.WindowStart > Window;
            if (lockExpired || windowExpired)
            {
                entry.Failures = 0;
                entry.WindowStart = now;
                entry.LockedUntil = null;
            }
            entry.Failures++;
            if (entry.Failures >= limit && entry.LockedUntil == null) entry.LockedUntil = now + LockOut;
        }
    }

    private void Prune()
    {
        var now = DateTime.UtcNow;
        foreach (var (key, entry) in _entries)
            if ((entry.LockedUntil == null || entry.LockedUntil <= now) && now - entry.WindowStart > Window)
                _entries.TryRemove(key, out _);
    }
}
