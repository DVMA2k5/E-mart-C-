using System.ComponentModel.DataAnnotations;

namespace backend.DTO;

public class PosCheckoutRequest
{
    [Required] public string RequestId { get; set; } = "";
    public int? CustomerId { get; set; }
    [Range(0, int.MaxValue)] public int PointsUsed { get; set; }
    public int? PromotionId { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    public decimal? CashReceived { get; set; }
    public decimal? ExpectedTotal { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
    [Required, MinLength(1), MaxLength(200)] public List<PosCheckoutLine> Items { get; set; } = [];
}

public class PosCheckoutLine
{
    [Range(1, int.MaxValue)] public int ProductId { get; set; }
    [Range(1, 1000)] public int Quantity { get; set; }
}

public class PosPaymentConfirmation
{
    [Required, MaxLength(200)] public string Reference { get; set; } = "";
    [Range(typeof(decimal), "0", "9999999999")] public decimal Amount { get; set; }
}

public class PosCashConfirmation
{
    [Range(typeof(decimal), "0", "9999999999")] public decimal CashReceived { get; set; }
}

public class PosCheckoutResponse
{
    public bool IsLegacy { get; set; }
    public int Id { get; set; }
    public string OrderNumber { get; set; } = "";
    public string Status { get; set; } = "";
    public string PaymentStatus { get; set; } = "";
    public string? PaymentMethod { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal? CashReceived { get; set; }
    public decimal ChangeDue { get; set; }
    public int PointsUsed { get; set; }
    public int PointsEarned { get; set; }
    public string? CustomerName { get; set; }
    public int? CustomerId { get; set; }
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public int? PromotionId { get; set; }
    public string? Note { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? RecipientName { get; set; }
    public string? RecipientPhone { get; set; }
    public string? ShippingAddress { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<PosCheckoutItemResponse> Items { get; set; } = [];
}

public class PosCheckoutItemResponse
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
}
