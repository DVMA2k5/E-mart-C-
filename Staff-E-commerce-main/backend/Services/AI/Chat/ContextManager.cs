using backend.DTO;
using backend.Services.AI.Shared;
using Microsoft.SemanticKernel.ChatCompletion;

namespace backend.Services.AI.Chat
{
    public class ContextManager
    {
        private readonly TokenizerService _tokenizer;
        private readonly ILogger<ContextManager> _logger;

        public ContextManager(TokenizerService tokenizer, ILogger<ContextManager> logger)
        {
            _tokenizer = tokenizer;
            _logger = logger;
        }

        public ChatHistory BuildManagedChatHistory(string systemPrompt, List<ClientMessageDTO>? clientHistory, string userMessage)
        {
            var chatHistory = new ChatHistory();
            chatHistory.AddSystemMessage(systemPrompt);

            var systemTokens = _tokenizer.CountTokens(systemPrompt);
            var userTokens = _tokenizer.CountTokens(userMessage);
            var functionTokens = _tokenizer.EstimateFunctionTokens(AiConstants.EstimatedFunctionCount);

            var availableForHistory = AiConstants.ModelContextWindow
                - AiConstants.MaxOutputTokens
                - systemTokens
                - userTokens
                - functionTokens
                - AiConstants.SafetyBuffer;

            if (clientHistory != null && clientHistory.Count > 0)
            {
                var selectedMessages = SelectHistoryWithTokenBudget(clientHistory, availableForHistory);
                foreach (var msg in selectedMessages)
                {
                    if (msg.Role.Equals("user", StringComparison.OrdinalIgnoreCase))
                        chatHistory.AddUserMessage(msg.Content);
                    else if (msg.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase))
                        chatHistory.AddAssistantMessage(msg.Content);
                }
            }

            chatHistory.AddUserMessage(userMessage);
            return chatHistory;
        }

        public string TruncateToolResult(string result)
        {
            return _tokenizer.TruncateToTokenLimit(result, AiConstants.MaxToolResultTokens);
        }

        private List<ClientMessageDTO> SelectHistoryWithTokenBudget(List<ClientMessageDTO> history, int tokenBudget)
        {
            var result = new List<ClientMessageDTO>();

            var windowed = history
                .Where(m => !string.IsNullOrEmpty(m.Content))
                .TakeLast(AiConstants.MaxHistoryMessages)
                .ToList();

            var messagesWithTokens = windowed
                .Select(m => new
                {
                    Message = m,
                    Tokens = Math.Min(
                        _tokenizer.CountMessageTokens(m.Role, m.Content),
                        AiConstants.MaxSingleMessageTokens)
                })
                .ToList();

            var usedTokens = 0;
            var selectedIndices = new List<int>();

            for (int i = messagesWithTokens.Count - 1; i >= 0; i--)
            {
                var item = messagesWithTokens[i];
                if (usedTokens + item.Tokens <= tokenBudget)
                {
                    selectedIndices.Insert(0, i);
                    usedTokens += item.Tokens;
                }
                else
                {
                    var droppedCount = i + 1;
                    if (droppedCount > 0)
                    {
                        _logger.LogInformation("Context truncation: Dropped {DroppedCount} older messages, kept {KeptCount}",
                            droppedCount, selectedIndices.Count);
                    }
                    break;
                }
            }

            foreach (var idx in selectedIndices)
            {
                var msg = messagesWithTokens[idx].Message;
                var content = msg.Content;

                if (_tokenizer.CountTokens(content) > AiConstants.MaxSingleMessageTokens)
                    content = _tokenizer.TruncateToTokenLimit(content, AiConstants.MaxSingleMessageTokens);

                result.Add(new ClientMessageDTO { Role = msg.Role, Content = content });
            }

            return result;
        }
    }
}
