namespace backend.DTO
{
    public class ProductPromotionAvailabilityDTO
    {
        public int ProductId { get; set; }
        public int PromotionId { get; set; }
        public string PromotionName { get; set; } = string.Empty;
        public DateTime? EndDate { get; set; }
    }
}
