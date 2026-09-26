using Microsoft.ML.Tokenizers;
using System.Collections.Concurrent;
using backend.Services.AI.Shared;

namespace backend.Services
{
    public class TokenizerService
    {
        private readonly Tokenizer _tokenizer;
        private readonly ILogger<TokenizerService> _logger;
        private readonly LruCache<string, int> _tokenCache;

        public TokenizerService(ILogger<TokenizerService> logger)
        {
            _logger = logger;
            _tokenCache = new LruCache<string, int>(AiConstants.TokenCacheMaxSize);
            _tokenizer = TiktokenTokenizer.CreateForModel("gpt-4");
        }

        public int CountTokens(string? text)
        {
            if (string.IsNullOrEmpty(text)) return 0;

            var cacheKey = text.Length > 200
                ? $"{text.Length}:{text.GetHashCode()}:{text[..50]}:{text[^50..]}"
                : text;

            if (_tokenCache.TryGet(cacheKey, out var cached))
                return cached;

            var count = _tokenizer.CountTokens(text);
            _tokenCache.Set(cacheKey, count);
            return count;
        }

        public int CountMessageTokens(string role, string content)
        {
            const int MESSAGE_OVERHEAD = 4;
            return CountTokens(content) + MESSAGE_OVERHEAD;
        }

        public int CountMessagesTokens(IEnumerable<(string role, string content)> messages)
        {
            const int CONVERSATION_OVERHEAD = 3;
            var total = CONVERSATION_OVERHEAD;
            foreach (var (role, content) in messages)
                total += CountMessageTokens(role, content);
            return total;
        }

        public int EstimateFunctionTokens(int functionCount)
        {
            const int TOKENS_PER_FUNCTION = 200;
            return functionCount * TOKENS_PER_FUNCTION;
        }

        public string TruncateToTokenLimit(string text, int maxTokens)
        {
            if (string.IsNullOrEmpty(text)) return text;

            var tokens = CountTokens(text);
            if (tokens <= maxTokens) return text;

            int low = 0, high = text.Length, bestLength = 0;

            while (low <= high)
            {
                int mid = (low + high) / 2;
                var truncatedTokens = CountTokens(text[..mid]);

                if (truncatedTokens <= maxTokens)
                {
                    bestLength = mid;
                    low = mid + 1;
                }
                else
                {
                    high = mid - 1;
                }
            }

            if (bestLength == 0) return "[content too long]";

            var result = text[..bestLength];
            var lastSpace = result.LastIndexOf(' ');
            if (lastSpace > bestLength * 0.8)
                result = result[..lastSpace];

            return result + "...[truncated]";
        }

        public (int size, int hits, int misses) GetCacheStats() => _tokenCache.GetStats();
    }

    public class LruCache<TKey, TValue> where TKey : notnull
    {
        private readonly int _capacity;
        private readonly ConcurrentDictionary<TKey, LinkedListNode<CacheItem>> _cache;
        private readonly LinkedList<CacheItem> _lruList;
        private readonly object _lock = new();
        private int _hits, _misses;

        public LruCache(int capacity)
        {
            _capacity = capacity;
            _cache = new ConcurrentDictionary<TKey, LinkedListNode<CacheItem>>();
            _lruList = new LinkedList<CacheItem>();
        }

        public bool TryGet(TKey key, out TValue value)
        {
            if (_cache.TryGetValue(key, out var node))
            {
                lock (_lock)
                {
                    _lruList.Remove(node);
                    _lruList.AddFirst(node);
                }
                Interlocked.Increment(ref _hits);
                value = node.Value.Value;
                return true;
            }

            Interlocked.Increment(ref _misses);
            value = default!;
            return false;
        }

        public void Set(TKey key, TValue value)
        {
            lock (_lock)
            {
                if (_cache.TryGetValue(key, out var existingNode))
                {
                    _lruList.Remove(existingNode);
                    existingNode.Value = new CacheItem(key, value);
                    _lruList.AddFirst(existingNode);
                    return;
                }

                while (_cache.Count >= _capacity && _lruList.Last != null)
                {
                    var lruNode = _lruList.Last;
                    _lruList.RemoveLast();
                    _cache.TryRemove(lruNode.Value.Key, out _);
                }

                var newNode = new LinkedListNode<CacheItem>(new CacheItem(key, value));
                _lruList.AddFirst(newNode);
                _cache[key] = newNode;
            }
        }

        public (int size, int hits, int misses) GetStats() => (_cache.Count, _hits, _misses);

        private class CacheItem
        {
            public TKey Key { get; }
            public TValue Value { get; set; }
            public CacheItem(TKey key, TValue value) { Key = key; Value = value; }
        }
    }
}
