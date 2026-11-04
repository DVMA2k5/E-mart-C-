namespace backend.DTO
{
    public class PromotionDTO
    {
        public int Id { get; set; }
        // Public, customer-entered code. Only vouchers have one.
        public string Code { get; set; } = string.Empty;
        public string Type { get; set; } = "event"; // product | event | voucher
        public string DiscountType { get; set; } = "percent"; // percent | fixed
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }
        public string? VoucherCode { get; set; }
        public string Visibility { get; set; } = "public";
        public bool SendToCustomers { get; set; }
        public DateTime? ClaimStartDate { get; set; }
        public DateTime? ClaimEndDate { get; set; }
        public int? ClaimLimit { get; set; }
        public int ClaimedCount { get; set; }
        public bool IsClaimed { get; set; }
        /// <summary>Why the customer cannot save this voucher right now (null when they can).</summary>
        public string? ClaimIssue { get; set; }
        public int? ClaimId { get; set; }
        public DateTime? ClaimedAt { get; set; }
        public DateTime? UsedAt { get; set; }
        public string? WalletStatus { get; set; }
        public int? ReservedOrderId { get; set; }
        public string? OrderNumber { get; set; }
        public List<int> ProductIds { get; set; } = new();
        public decimal? MaxDiscount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? UsageLimit { get; set; }
        public int UsedCount { get; set; }
        public bool Active { get; set; }
        public string? Status { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
