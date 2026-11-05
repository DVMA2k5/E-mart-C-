namespace backend.DTO
{
    public class PromotionRedemptionDTO
    {
        public int Id { get; set; }
        public int PromotionId { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int? OrderId { get; set; }
        public string? OrderNumber { get; set; }
        public decimal OrderAmount { get; set; }
        public DateTime RedeemedAt { get; set; }
        public string PromotionName { get; set; } = string.Empty;
        public string PromotionType { get; set; } = string.Empty;
        public string? PromotionCode { get; set; }
        public DateTime? PromotionEndDate { get; set; }
    }
}
