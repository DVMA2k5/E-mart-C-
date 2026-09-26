using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using backend.Services.AI;
using backend.Services.AI.Shared;
using backend.DTO;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly SemanticKernelService _aiService;
        private readonly ILogger<AiController> _logger;

        public AiController(SemanticKernelService aiService, ILogger<AiController> logger)
        {
            _aiService = aiService;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst("uid") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int id))
                return id;
            return 0;
        }

        /// <summary>
        /// Non-streaming chat endpoint
        /// </summary>
        [HttpPost("chat")]
        [ProducesResponseType(typeof(AiChatResponseDTO), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(401)]
        [ProducesResponseType(429)]
        public async Task<ActionResult<AiChatResponseDTO>> Chat([FromBody] AiChatRequestDTO request)
        {
            // Validate request
            if (request == null)
            {
                return BadRequest(new AiChatResponseDTO
                {
                    Success = false,
                    Error = "Request không hợp lệ"
                });
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new AiChatResponseDTO
                {
                    Success = false,
                    Error = "Vui lòng nhập câu hỏi"
                });
            }

            if (request.Message.Length > AiConstants.MaxMessageLength)
            {
                return BadRequest(new AiChatResponseDTO
                {
                    Success = false,
                    Error = $"Tin nhắn quá dài (tối đa {AiConstants.MaxMessageLength} ký tự)"
                });
            }

            var userId = GetCurrentUserId();
            if (userId == 0)
            {
                return Unauthorized(new AiChatResponseDTO
                {
                    Success = false,
                    Error = "Vui lòng đăng nhập"
                });
            }

            try
            {
                _logger.LogInformation("User {UserId} sending chat message", userId);
                var response = await _aiService.ChatAsync(request.Message, userId, request.ConversationId);
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Chat endpoint for user {UserId}", userId);
                return StatusCode(500, new AiChatResponseDTO
                {
                    Success = false,
                    Error = "Lỗi server, vui lòng thử lại sau"
                });
            }
        }

        /// <summary>
        /// Streaming chat endpoint using Server-Sent Events
        /// </summary>
        [HttpPost("stream")]
        public async Task StreamChat([FromBody] AiChatRequestDTO request)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no"); // Disable nginx buffering

            var userId = GetCurrentUserId();

            // Validation
            if (userId == 0)
            {
                await SendStreamError("Vui lòng đăng nhập");
                return;
            }

            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                await SendStreamError("Vui lòng nhập câu hỏi");
                return;
            }

            if (request.Message.Length > AiConstants.MaxMessageLength)
            {
                await SendStreamError($"Tin nhắn quá dài (tối đa {AiConstants.MaxMessageLength} ký tự)");
                return;
            }

            // Validate history if provided
            if (request.History != null && request.History.Count > 50)
            {
                await SendStreamError("Lịch sử chat quá dài");
                return;
            }

            try
            {
                _logger.LogInformation("User {UserId} starting stream chat", userId);

                var cancellationToken = HttpContext.RequestAborted;

                await foreach (var streamChunk in _aiService.ChatStreamAsync(
                    request.Message,
                    userId,
                    request.ConversationId,
                    request.History).WithCancellation(cancellationToken))
                {
                    // Handle special convId format
                    if (streamChunk.StartsWith("convId:"))
                    {
                        var pipeIndex = streamChunk.IndexOf('|');
                        if (pipeIndex > 0)
                        {
                            var convIdStr = streamChunk.Substring(7, pipeIndex - 7);
                            var content = streamChunk.Substring(pipeIndex + 1);

                            // Send conversationId
                            await SendStreamData(new { conversationId = int.Parse(convIdStr) });

                            // Send content if any
                            if (!string.IsNullOrEmpty(content))
                            {
                                await SendStreamData(new { content });
                            }
                            continue;
                        }
                    }

                    // Normal content
                    await SendStreamData(new { content = streamChunk });
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Stream cancelled for user {UserId}", userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in StreamChat for user {UserId}", userId);
                await SendStreamError("Đã xảy ra lỗi, vui lòng thử lại");
            }

            await SendStreamDone();
        }

        /// <summary>
        /// Get user's conversation list
        /// </summary>
        [HttpGet("conversations")]
        [ProducesResponseType(typeof(List<AiConversationDTO>), 200)]
        public async Task<ActionResult<List<AiConversationDTO>>> GetConversations()
        {
            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var conversations = await _aiService.GetConversationsAsync(userId);
                return Ok(conversations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting conversations for user {UserId}", userId);
                return StatusCode(500, new { error = "Không thể tải danh sách hội thoại" });
            }
        }

        /// <summary>
        /// Get conversation with messages
        /// </summary>
        [HttpGet("conversations/{id:int}")]
        [ProducesResponseType(typeof(AiConversationDTO), 200)]
        [ProducesResponseType(404)]
        public async Task<ActionResult<AiConversationDTO>> GetConversation(int id)
        {
            if (id <= 0)
            {
                return BadRequest(new { error = "ID không hợp lệ" });
            }

            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                var conversation = await _aiService.GetConversationAsync(id, userId);
                if (conversation == null)
                    return NotFound(new { error = "Không tìm thấy cuộc hội thoại" });

                return Ok(conversation);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting conversation {ConversationId} for user {UserId}", id, userId);
                return StatusCode(500, new { error = "Không thể tải cuộc hội thoại" });
            }
        }

        /// <summary>
        /// Delete a conversation
        /// </summary>
        [HttpDelete("conversations/{id:int}")]
        [ProducesResponseType(200)]
        [ProducesResponseType(404)]
        public async Task<ActionResult> DeleteConversation(int id)
        {
            if (id <= 0)
            {
                return BadRequest(new { error = "ID không hợp lệ" });
            }

            var userId = GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            try
            {
                await _aiService.DeleteConversationAsync(id, userId);
                return Ok(new { success = true, message = "Đã xóa cuộc hội thoại" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting conversation {ConversationId}", id);
                return StatusCode(500, new { error = "Không thể xóa cuộc hội thoại" });
            }
        }

        /// <summary>
        /// Health check endpoint (no auth required)
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public ActionResult HealthCheck()
        {
            var stats = _aiService.GetPluginStats();
            return Ok(new
            {
                status = "ok",
                message = "AI Service (Semantic Kernel) is running",
                timestamp = DateTime.UtcNow,
                pluginCount = stats.pluginCount,
                functionCount = stats.functionCount
            });
        }

        #region Stream Helpers

        private async Task SendStreamData(object data)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(data);
            await Response.WriteAsync($"data: {json}\n\n");
            await Response.Body.FlushAsync();
        }

        private async Task SendStreamError(string error)
        {
            await SendStreamData(new { error });
            await SendStreamDone();
        }

        private async Task SendStreamDone()
        {
            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }

        #endregion
    }
}
