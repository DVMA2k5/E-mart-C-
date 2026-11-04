namespace backend.DTO;

public sealed class OrderHistoryEntryDTO
{
    public string Action { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class OnlineTransferConfirmation
{
    public string? Reference { get; set; }
}
