using backend.Services.AI.Shared;
using System.Collections.Concurrent;

namespace backend.Services.AI.Chat
{
    public class RateLimitService
    {
        private static readonly ConcurrentDictionary<int, UserRateLimit> _userRateLimits = new();
        private static DateTime _lastCleanup = DateTime.UtcNow;
        private static readonly object _cleanupLock = new();

        public bool CheckRateLimit(int userId)
        {
            CleanupExpiredRateLimits();

            var now = DateTime.UtcNow;
            var rateLimit = _userRateLimits.GetOrAdd(userId, _ => new UserRateLimit());

            lock (rateLimit)
            {
                rateLimit.LastActivity = now;
                rateLimit.RequestTimes.RemoveAll(t => (now - t).TotalMinutes > 1);

                if (rateLimit.RequestTimes.Count >= AiConstants.RateLimitRequestsPerMinute)
                    return false;

                rateLimit.RequestTimes.Add(now);
                return true;
            }
        }

        private static void CleanupExpiredRateLimits()
        {
            var now = DateTime.UtcNow;
            if ((now - _lastCleanup).TotalMinutes < AiConstants.RateLimitCleanupIntervalMinutes) return;

            lock (_cleanupLock)
            {
                if ((now - _lastCleanup).TotalMinutes < AiConstants.RateLimitCleanupIntervalMinutes) return;

                var expiredUsers = new List<int>();
                foreach (var kvp in _userRateLimits)
                {
                    var rateLimit = kvp.Value;
                    lock (rateLimit)
                    {
                        rateLimit.RequestTimes.RemoveAll(t => (now - t).TotalMinutes > 1);
                        if (rateLimit.RequestTimes.Count == 0 &&
                            (now - rateLimit.LastActivity).TotalMinutes > AiConstants.RateLimitEntryExpirationMinutes)
                            expiredUsers.Add(kvp.Key);
                    }
                }

                foreach (var userId in expiredUsers)
                    _userRateLimits.TryRemove(userId, out _);

                _lastCleanup = now;
            }
        }

        private class UserRateLimit
        {
            public List<DateTime> RequestTimes { get; } = new();
            public DateTime LastActivity { get; set; } = DateTime.UtcNow;
        }
    }
}
