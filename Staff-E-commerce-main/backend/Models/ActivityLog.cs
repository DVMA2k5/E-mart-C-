using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models
{
    [Table("activity_logs")]
    [Index(nameof(UserId), Name = "idx_activity_user")]
    [Index(nameof(Action), Name = "idx_activity_action")]
    public class ActivityLog
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public int? UserId { get; set; }

        [Column("action")]
        [StringLength(191)]
        public string Action { get; set; } = string.Empty;

        [Column("entity_type")]
        [StringLength(100)]
        public string? EntityType { get; set; }

        [Column("entity_id")]
        [StringLength(100)]
        public string? EntityId { get; set; }

        // JSON payload stored as text in SQL Server.
        [Column("payload", TypeName = "nvarchar(max)")]
        public string? Payload { get; set; }

        [Column("ip_address")]
        [StringLength(50)]
        public string? IpAddress { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        // Navigation
        [ForeignKey(nameof(UserId))]
        public virtual User? User { get; set; }
    }
}
