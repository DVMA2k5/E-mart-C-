using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models
{
    [Table("voucher_promotions")]
    public class VoucherPromotion
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("promotion_id")]
        public int PromotionId { get; set; }

        [Required]
        [Column("voucher_code")]
        [StringLength(50)]
        public string VoucherCode { get; set; } = string.Empty;

        [Column("discount_percent", TypeName = "decimal(5,2)")]
        public decimal DiscountPercent { get; set; }

        [Column("max_discount_amount", TypeName = "decimal(12,2)")]
        public decimal? MaxDiscountAmount { get; set; }

        [Column("usage_limit")]
        public int? UsageLimit { get; set; }

        [Column("used_count")]
        public int UsedCount { get; set; }

        public virtual Promotion Promotion { get; set; } = null!;
    }
}