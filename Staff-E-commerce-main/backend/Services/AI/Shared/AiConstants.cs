namespace backend.Services.AI.Shared
{
    public static class AiConstants
    {
        #region Token Limits

        public const int MaxToolResultTokens = 8000;
        public const int MaxOutputTokens = 4000;
        public const int ModelContextWindow = 32000;
        public const int SafetyBuffer = 500;
        public const int MaxSingleMessageTokens = 2000;

        #endregion

        #region Message Limits

        public const int MaxMessageLength = 4000;
        public const int MaxHistoryMessages = 40;

        #endregion

        #region Rate Limiting

        public const int RateLimitRequestsPerMinute = 100;
        public const int RateLimitCleanupIntervalMinutes = 5;
        public const int RateLimitEntryExpirationMinutes = 10;

        #endregion

        #region Retry & Timeout (Reserved for future use)

        // TODO: Implement retry logic using these constants
        // public const int MaxRetryAttempts = 3;
        // public const int ToolTimeoutSeconds = 30;

        #endregion

        #region Cache

        // TODO: Implement tool result caching
        // public const int ToolCacheDurationSeconds = 60;
        public const int TokenCacheMaxSize = 2000;

        #endregion

        #region Function Tools

        public const int EstimatedFunctionCount = 10;

        #endregion

        #region Vector Store

        public const string ProductCollectionName = "products";
        
        // TODO: Use these for search filtering
        // public const int DefaultSearchLimit = 20;
        // public const float MinSearchScore = 0.5f;

        #endregion
    }
}
