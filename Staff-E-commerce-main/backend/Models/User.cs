using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models
{
    [Table("users")]
    [Index(nameof(Username), IsUnique = true, Name = "ux_users_username")]
    [Index(nameof(Email), IsUnique = true, Name = "ux_users_email")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("username")]
        [StringLength(150)]
        public string Username { get; set; } = string.Empty;

        [Column("email")]
        [StringLength(255)]
        public string? Email { get; set; }

        // LƯU Ý: đây là hash, KHÔNG lưu mật khẩu plaintext
        [Required]
        [Column("password_hash")]
        [StringLength(512)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [Column("full_name")]
        [StringLength(255)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [Column("role_id")]
        public int RoleId { get; set; }

        public virtual Role RoleEntity { get; set; } = null!;

        [Column("employee_id")]
        public int? EmployeeId { get; set; }

        [Column("customer_id")]
        public int? CustomerId { get; set; }

        public virtual Employee? Employee { get; set; }
        public virtual Customer? Customer { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("last_login")]
        public DateTime? LastLogin { get; set; }

        [Column("locked")]
        public bool IsLocked { get; set; } = false;

        [Column("session_version")]
        public int SessionVersion { get; set; }

        // Navigation
        public virtual ICollection<Order>? Orders { get; set; }         // orders created by this user
        public virtual ICollection<InventoryAdjustment>? InventoryAdjustments { get; set; }
        public virtual ICollection<ActivityLog>? ActivityLogs { get; set; }

    }
}
