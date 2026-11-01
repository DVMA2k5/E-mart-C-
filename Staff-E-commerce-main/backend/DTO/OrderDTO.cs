namespace backend.DTO
{
    public class OrderDTO
    {
        public int Id { get; set; }
        public string OrderNumber { get; set; } = string.Empty;
        public int? CustomerId { get; set; } = 0;
        public int? UserId { get; set; }
        public string Status { get; set; } = "pending";
        public string OrderType { get; set; } = "pos";
        public string? PaymentStatus { get; set; }
        public string? PaymentMethod { get; set; }
        public bool IsPosCheckout { get; set; }
        public decimal Subtotal { get; set; } = 0m;
        public decimal Discount { get; set; } = 0m;
        public decimal TotalAmount { get; set; } = 0m;
        public int TotalQuantity { get; set; }
        public int? PromotionId { get; set; } = null;
        public string? Note { get; set; } = null;
        public string? RecipientName { get; set; }
        public string? RecipientPhone { get; set; }
        public string? ShippingAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Thông tin mở rộng (hiển thị)
        public string? CustomerName { get; set; }
        public string? UserName { get; set; }
        public string? PromotionCode { get; set; }
    }
}
