using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models;

[Table("customer_vouchers")]
[Index(nameof(PromotionId), nameof(CustomerId), IsUnique = true, Name = "ux_customer_vouchers_owner")]
public sealed class CustomerVoucher
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("promotion_id")] public int PromotionId { get; set; }
    [Column("customer_id")] public int CustomerId { get; set; }
    [Column("claimed_at")] public DateTime ClaimedAt { get; set; }
    [Column("source"), StringLength(20)] public string Source { get; set; } = "manual";
    [Column("order_id")] public int? OrderId { get; set; }
    [Column("used_at")] public DateTime? UsedAt { get; set; }
    public Promotion Promotion { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Order? Order { get; set; }
}
