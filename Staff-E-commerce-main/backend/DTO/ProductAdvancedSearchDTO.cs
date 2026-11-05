namespace backend.DTO;

public sealed class ProductAdvancedSearchRequestDTO
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Search { get; set; }
    public int? CategoryId { get; set; }
    public int? SupplierId { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public string? SortBy { get; set; } = "id";
    public int? Status { get; set; }
    public string? StockStatus { get; set; }
    public List<ProductSearchConditionDTO> Conditions { get; set; } = new();
}

public sealed class ProductSearchConditionDTO
{
    public string Field { get; set; } = string.Empty;
    public string Operator { get; set; } = "==";
    public string Value { get; set; } = string.Empty;

    // Connects this condition to the previous one. The first condition ignores Logic.
    public string Logic { get; set; } = "AND";
    public bool Negate { get; set; }
}
