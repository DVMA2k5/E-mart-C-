using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models
{
    [Table("ai_messages")]
    [Index(nameof(ConversationId), Name = "idx_ai_messages_conversation")]
    public class AiMessage
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("conversation_id")]
        public int ConversationId { get; set; }

        [Required]
        [Column("role")]
        [StringLength(20)]
        public string Role { get; set; } = string.Empty; // "user" or "assistant"

        [Required]
        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Column("function_called")]
        [StringLength(100)]
        public string? FunctionCalled { get; set; }

        [Column("function_data", TypeName = "nvarchar(max)")]
        public string? FunctionData { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(ConversationId))]
        public virtual AiConversation? Conversation { get; set; }
    }
}
