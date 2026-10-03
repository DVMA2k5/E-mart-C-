using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models
{
    [Table("promotions")]
    [Index(nameof(Code), IsUnique = true, Name = "ux_promotions_code")]
    public class Promotion
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("code")]
        [StringLength(100)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [Column("name")]
        [StringLength(150)]
        public string Name { get; set; } = string.Empty;

        [Column("type")]
        [StringLength(20)]
        public string PromotionKind { get; set; } = "event";

        [NotMapped]
        public string Type { get; set; } = "percent";

        [NotMapped]
        public decimal Value { get; set; } = 0m;

        [NotMapped]
        public decimal MinOrderAmount { get; set; } = 0m;

        [Column("max_discount", TypeName = "decimal(12,2)")]
        public decimal? MaxDiscount { get; set; }

        [Column("start_date")]
        public DateTime? StartDate { get; set; }

        [Column("end_date")]
        public DateTime? EndDate { get; set; }

        [Column("usage_limit")]
        public int? UsageLimit { get; set; }

        [Column("used_count")]
        public int UsedCount { get; set; } = 0;

        [NotMapped]
        public bool Active { get; set; } = true;

        [Column("status")]
        [StringLength(20)]
        public string Status { get; set; } = "active";

        [Column("description")]
        [StringLength(1000)]
        public string? Description { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; }

        // Soft delete
        [Column("is_deleted")]
        public bool IsDeleted { get; set; } = false;

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        // Navigation
        public virtual ICollection<Order>? Orders { get; set; }
        public virtual ICollection<PromotionRedemption>? Redemptions { get; set; }
        public virtual EventPromotion? EventPromotion { get; set; }
        public virtual VoucherPromotion? VoucherPromotion { get; set; }
        public virtual ICollection<ProductPromotion> ProductPromotions { get; set; } = new List<ProductPromotion>();

        [NotMapped]
        public List<int> ProductIds { get; set; } = new();

        [NotMapped]
        public string? VoucherCode { get; set; }
    }
}
