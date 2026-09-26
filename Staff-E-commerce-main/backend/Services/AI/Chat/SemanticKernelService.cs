using backend.DTO;
using backend.Repository;
using backend.Services.AI.Chat;
using backend.Services.AI.Chat.Prompts;
using backend.Services.AI.Plugins;
using backend.Services.AI.Shared;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace backend.Services.AI
{
    public class SemanticKernelService : IDisposable
    {
        private readonly AiRepository _aiRepository;
        private readonly ILogger<SemanticKernelService> _logger;
        private readonly ContextManager _contextManager;
        private readonly RateLimitService _rateLimitService;
        private readonly Kernel _kernel;
        private readonly IChatCompletionService _chatCompletion;
        private bool _disposed = false;

        public (int pluginCount, int functionCount) GetPluginStats()
        {
            var funcCount = _kernel.Plugins.SelectMany(p => p).Count();
            return (_kernel.Plugins.Count, funcCount);
        }

        public SemanticKernelService(
            AiRepository aiRepository,
            IConfiguration config,
            ILogger<SemanticKernelService> logger,
            IServiceProvider serviceProvider,
            ContextManager contextManager,
            RateLimitService rateLimitService)
        {
            _aiRepository = aiRepository;
            _logger = logger;
            _contextManager = contextManager;
            _rateLimitService = rateLimitService;

            var apiKey = config["Chutes:ApiKey"]
                ?? throw new InvalidOperationException("Chutes API key not configured");
            var endpoint = new Uri(config["Chutes:Endpoint"] ?? "https://llm.chutes.ai/v1");
            var model = config["Chutes:Model"] ?? "Qwen/Qwen2.5-72B-Instruct";

            var builder = Kernel.CreateBuilder();
            builder.AddOpenAIChatCompletion(modelId: model, apiKey: apiKey, endpoint: endpoint);
            RegisterAllPlugins(builder, serviceProvider);

            _kernel = builder.Build();
            _chatCompletion = _kernel.GetRequiredService<IChatCompletionService>();
        }

        private void RegisterAllPlugins(IKernelBuilder builder, IServiceProvider serviceProvider)
        {
            builder.Plugins.AddFromObject(new ProductPlugin(serviceProvider), "Product");
            builder.Plugins.AddFromObject(new CategoryPlugin(serviceProvider), "Category");
            builder.Plugins.AddFromObject(new CustomerPlugin(serviceProvider), "Customer");
            builder.Plugins.AddFromObject(new OrderPlugin(serviceProvider), "Order");
            builder.Plugins.AddFromObject(new PromotionPlugin(serviceProvider), "Promotion");
            builder.Plugins.AddFromObject(new SupplierPlugin(serviceProvider), "Supplier");
            builder.Plugins.AddFromObject(new StatisticsPlugin(serviceProvider), "Statistics");
            builder.Plugins.AddFromObject(new ReportsPlugin(serviceProvider), "Reports");
            builder.Plugins.AddFromObject(new ProductSemanticSearchPlugin(serviceProvider), "ProductSemanticSearch");
        }

        #region Chat Methods

        public async Task<AiChatResponseDTO> ChatAsync(string userMessage, int userId, int? conversationId = null)
        {
            try
            {
                var validationError = ValidateUserMessage(userMessage, userId);
                if (validationError != null)
                    return new AiChatResponseDTO { Success = false, Error = validationError };

                int convId = await PrepareConversationAsync(userMessage, userId, conversationId);

                var chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(SystemPromptProvider.GetPosAssistantPrompt());
                chatHistory.AddUserMessage(userMessage);

                var settings = new OpenAIPromptExecutionSettings
                {
                    FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
                };

                var result = await _chatCompletion.GetChatMessageContentAsync(chatHistory, settings, _kernel);
                var response = result.Content ?? "";

                if (!string.IsNullOrEmpty(response))
                    await _aiRepository.AddMessageAsync(convId, "assistant", response);

                return new AiChatResponseDTO { Success = true, Response = response, ConversationId = convId };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ChatAsync for user {UserId}", userId);
                return new AiChatResponseDTO { Success = false, Error = GetUserFriendlyError(ex) };
            }
        }

        public async IAsyncEnumerable<string> ChatStreamAsync(
            string userMessage,
            int userId,
            int? conversationId = null,
            List<ClientMessageDTO>? clientHistory = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var validationError = ValidateUserMessage(userMessage, userId);
            if (validationError != null)
            {
                yield return $"⚠️ {validationError}";
                yield break;
            }

            int? convId = conversationId;
            string? prepareError = null;

            try
            {
                if (!convId.HasValue)
                {
                    var title = GenerateConversationTitle(userMessage);
                    var conversation = await _aiRepository.CreateConversationAsync(userId, title);
                    convId = conversation.Id;
                }
                await _aiRepository.AddMessageAsync(convId.Value, "user", userMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error preparing conversation");
                prepareError = GetUserFriendlyError(ex);
            }

            if (prepareError != null)
            {
                yield return $"❌ Lỗi: {prepareError}";
                yield break;
            }

            yield return $"convId:{convId}|";

            var fullResponse = new StringBuilder();
            var chatHistory = _contextManager.BuildManagedChatHistory(
                SystemPromptProvider.GetPosAssistantPrompt(),
                clientHistory,
                userMessage);

            var settings = new OpenAIPromptExecutionSettings
            {
                FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(autoInvoke: false)
            };

            const int maxIterations = 10;
            int iteration = 0;

            while (iteration < maxIterations)
            {
                iteration++;
                AuthorRole? authorRole = null;
                var fccBuilder = new FunctionCallContentBuilder();

                await foreach (var chunk in _chatCompletion.GetStreamingChatMessageContentsAsync(
                    chatHistory, settings, _kernel, cancellationToken))
                {
                    if (!string.IsNullOrEmpty(chunk.Content))
                    {
                        fullResponse.Append(chunk.Content);
                        yield return chunk.Content;
                    }
                    authorRole ??= chunk.Role;
                    fccBuilder.Append(chunk);
                }

                var functionCalls = fccBuilder.Build();
                if (!functionCalls.Any()) break;

                var funcNames = functionCalls.Select(f => f.FunctionName).Distinct().ToList();
                yield return $"\n\n⏳ *Đang truy vấn: {string.Join(", ", funcNames)}...*\n\n";

                var assistantMessage = new ChatMessageContent(role: authorRole ?? AuthorRole.Assistant, content: null);
                foreach (var fc in functionCalls)
                    assistantMessage.Items.Add(fc);
                chatHistory.Add(assistantMessage);

                var invokeTasks = functionCalls.Select(async fc =>
                {
                    try
                    {
                        var result = await fc.InvokeAsync(_kernel, cancellationToken);
                        return (fc, result, (Exception?)null);
                    }
                    catch (Exception ex)
                    {
                        return (fc, (FunctionResultContent?)null, ex);
                    }
                });

                var results = await Task.WhenAll(invokeTasks);

                foreach (var (fc, result, error) in results)
                {
                    if (error != null)
                    {
                        chatHistory.Add(new FunctionResultContent(fc, $"Error: {error.Message}").ToChatMessage());
                    }
                    else if (result != null)
                    {
                        var resultStr = result.Result?.ToString() ?? "";
                        if (resultStr.Length > AiConstants.MaxToolResultTokens)
                        {
                            var truncated = _contextManager.TruncateToolResult(resultStr);
                            chatHistory.Add(new FunctionResultContent(fc, truncated).ToChatMessage());
                        }
                        else
                        {
                            chatHistory.Add(result.ToChatMessage());
                        }
                    }
                }

                yield return "[TOOL_COMPLETE]";
            }

            if (fullResponse.Length > 0 && convId.HasValue)
            {
                try
                {
                    await _aiRepository.AddMessageAsync(convId.Value, "assistant", fullResponse.ToString());
                }
                catch { }
            }
        }

        #endregion

        #region Conversation Management

        public async Task<List<AiConversationDTO>> GetConversationsAsync(int userId)
        {
            var conversations = await _aiRepository.GetConversationsByUserIdAsync(userId);
            return conversations.Select(c => new AiConversationDTO
            {
                Id = c.Id,
                Title = c.Title,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList();
        }

        public async Task<AiConversationDTO?> GetConversationAsync(int conversationId, int userId)
        {
            var conversation = await _aiRepository.GetConversationByIdAsync(conversationId, userId);
            if (conversation == null) return null;

            return new AiConversationDTO
            {
                Id = conversation.Id,
                Title = conversation.Title,
                CreatedAt = conversation.CreatedAt,
                UpdatedAt = conversation.UpdatedAt,
                Messages = conversation.Messages.Select(m => new AiMessageDTO
                {
                    Id = m.Id,
                    Role = m.Role,
                    Content = m.Content,
                    FunctionCalled = m.FunctionCalled,
                    Data = string.IsNullOrEmpty(m.FunctionData) ? null : JsonSerializer.Deserialize<object>(m.FunctionData),
                    CreatedAt = m.CreatedAt
                }).ToList()
            };
        }

        public async Task DeleteConversationAsync(int conversationId, int userId)
        {
            await _aiRepository.DeleteConversationAsync(conversationId, userId);
        }

        #endregion

        #region Private Methods

        private string? ValidateUserMessage(string userMessage, int userId)
        {
            if (!_rateLimitService.CheckRateLimit(userId))
                return "Bạn đang gửi quá nhiều tin nhắn. Vui lòng đợi một chút.";

            if (string.IsNullOrWhiteSpace(userMessage))
                return "Vui lòng nhập câu hỏi";

            if (userMessage.Length > AiConstants.MaxMessageLength)
                return $"Tin nhắn quá dài (tối đa {AiConstants.MaxMessageLength:N0} ký tự)";

            return null;
        }

        private async Task<int> PrepareConversationAsync(string userMessage, int userId, int? conversationId)
        {
            int convId;
            if (conversationId.HasValue)
            {
                convId = conversationId.Value;
            }
            else
            {
                var title = GenerateConversationTitle(userMessage);
                var conversation = await _aiRepository.CreateConversationAsync(userId, title);
                convId = conversation.Id;
            }

            await _aiRepository.AddMessageAsync(convId, "user", userMessage);
            return convId;
        }

        private static string GenerateConversationTitle(string userMessage)
        {
            var title = userMessage.Length > 50 ? userMessage[..50] + "..." : userMessage;
            return System.Text.RegularExpressions.Regex.Replace(title, @"\s+", " ").Trim();
        }

        private static string GetUserFriendlyError(Exception ex)
        {
            if (ex.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase))
                return "Hệ thống đang bận, vui lòng thử lại sau ít phút";
            if (ex.Message.Contains("timeout", StringComparison.OrdinalIgnoreCase))
                return "Kết nối quá chậm, vui lòng thử lại";
            if (ex.Message.Contains("401") || ex.Message.Contains("403"))
                return "Lỗi xác thực API, vui lòng liên hệ admin";
            if (ex is HttpRequestException)
                return "Không thể kết nối đến AI service";
            return "Đã xảy ra lỗi, vui lòng thử lại";
        }

        #endregion

        #region IDisposable

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                GC.SuppressFinalize(this);
            }
        }

        #endregion
    }
}
