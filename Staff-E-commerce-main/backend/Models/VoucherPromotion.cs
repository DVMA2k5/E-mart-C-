using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models;

[Table("voucher_promotions")]
public class VoucherPromotion
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("promotion_id")] public int PromotionId { get; set; }
    [Column("voucher_code"), StringLength(50)] public string VoucherCode { get; set; } = string.Empty;
    [Column("discount_percent", TypeName = "decimal(5,2)")] public decimal? DiscountPercent { get; set; }
    [Column("visibility"), StringLength(20)] public string Visibility { get; set; } = "public";
    [Column("send_to_customers")] public bool SendToCustomers { get; set; }
    [Column("claim_start_date")] public DateTime? ClaimStartDate { get; set; }
    [Column("claim_end_date")] public DateTime? ClaimEndDate { get; set; }
    [Column("claim_limit")] public int? ClaimLimit { get; set; }
    [Column("claimed_count")] public int ClaimedCount { get; set; }
    public Promotion? Promotion { get; set; }
}
