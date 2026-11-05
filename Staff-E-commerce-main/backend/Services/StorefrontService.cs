using backend.DTO;
using backend.Helpers;
using backend.Repository;

namespace backend.Services;

public sealed class StorefrontService(
    StorefrontRepository repository,
    BusMemoryCache<StorefrontCategoryDTO> categoryCache,
    BusMemoryCache<StorefrontProductDTO> productCache)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan CatalogTtl = TimeSpan.FromSeconds(30);

    public Task<(bool Exists, string? Status)> GetCustomerOrderStatusAsync(int orderId, int customerId)
        => repository.GetCustomerOrderStatusAsync(orderId, customerId);

    public async Task<List<StorefrontCustomerOrderDTO>> GetCustomerOrdersAsync(int customerId)
    {
        var orders = await repository.GetCustomerOrdersAsync(customerId);
        return orders.Select(order => new StorefrontCustomerOrderDTO
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderType = order.OrderNumber.StartsWith("WEB-", StringComparison.Ordinal) ? "mobile" : order.OrderType,
            Status = order.Status,
            PaymentStatus = order.PaymentStatus,
            PaymentMethod = order.PaymentMethod,
            Subtotal = order.Subtotal,
            Discount = order.Discount,
            TotalAmount = order.TotalAmount,
            Note = order.Note,
            RecipientName = order.RecipientName,
            RecipientPhone = order.RecipientPhone,
            ShippingAddress = order.ShippingAddress,
            CreatedAt = order.CreatedAt,
            Items = order.OrderItems.Select(line => new StorefrontCustomerOrderItemDTO
            {
                ProductId = line.ProductId,
                ProductName = line.Product?.ProductName ?? "Sản phẩm",
                ImageUrl = line.Product?.ImageUrl,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                TotalPrice = line.TotalPrice
            }).ToList()
        }).ToList();
    }

    /// <summary>
    /// The storefront catalogue (names, images, prices, promotions) is built once and kept in RAM. Every committed
    /// write evicts it (CacheInvalidationSignal); the short TTL covers promotions that start or end by the clock.
    /// Stock is NOT trusted from this copy: every public read overlays live stock from SQL (see WithLiveStock).
    /// </summary>
    private async Task<IReadOnlyList<StorefrontProductDTO>> GetCatalogAsync()
    {
        var (items, _) = await productCache.GetOrCreateAsync(async () =>
        {
            var products = await MapProductsAsync(await repository.GetSellableProductsAsync());
            var sold = await repository.GetSoldQuantitiesAsync(DateTimeHelper.UtcNow.AddDays(-30));
            foreach (var product in products) product.SoldCount = sold.GetValueOrDefault(product.Id);
            foreach (var product in products.Where(p => p.SoldCount > 0).OrderByDescending(p => p.SoldCount).Take(10))
                product.IsBestSeller = true;
            // In-stock items first; out-of-stock items stay visible with a "Hết hàng" label.
            return products.OrderBy(product => product.StockQuantity > 0 ? 0 : 1).ToList();
        }, CatalogTtl);
        return items;
    }

    public async Task<List<StorefrontProductDTO>> GetAvailableProductsAsync() =>
        WithLiveStock(await GetCatalogAsync(), await repository.GetLiveStockAsync());

    public async Task<StorefrontProductPageDTO> GetAvailableProductsPageAsync(int page, int pageSize, bool discountedOnly)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        IEnumerable<StorefrontProductDTO> catalog = WithLiveStock(await GetCatalogAsync(), await repository.GetLiveStockAsync());
        if (discountedOnly) catalog = catalog.Where(product => product.DiscountAmount > 0 && product.StockQuantity > 0);
        var filtered = catalog as IReadOnlyCollection<StorefrontProductDTO> ?? catalog.ToList();
        return new StorefrontProductPageDTO
        {
            Items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalItems = filtered.Count
        };
    }

    public async Task<StorefrontProductDTO?> GetAvailableProductAsync(int productId)
    {
        var product = (await GetCatalogAsync()).FirstOrDefault(item => item.Id == productId);
        return product == null ? null : WithLiveStock([product], await repository.GetLiveStockAsync(productId)).FirstOrDefault();
    }

    /// <summary>
    /// Copies the cached products with the live stock level (cached objects are shared, so they are never edited).
    /// Products hidden since the catalogue was cached are dropped; in-stock items stay first.
    /// </summary>
    private static List<StorefrontProductDTO> WithLiveStock(
        IEnumerable<StorefrontProductDTO> products, IReadOnlyDictionary<int, int> stock) =>
        products.Where(product => stock.ContainsKey(product.Id))
            .Select(product => new StorefrontProductDTO
            {
                Id = product.Id,
                ProductName = product.ProductName,
                Description = product.Description,
                CategoryId = product.CategoryId,
                CategoryName = product.CategoryName,
                Price = product.Price,
                OriginalPrice = product.OriginalPrice,
                UnitName = product.UnitName,
                StockQuantity = Math.Max(0, stock[product.Id]),
                DiscountAmount = product.DiscountAmount,
                DiscountPercent = product.DiscountPercent,
                PromotionName = product.PromotionName,
                PromotionEndsAt = product.PromotionEndsAt,
                ImageUrl = product.ImageUrl,
                SoldCount = product.SoldCount,
                IsBestSeller = product.IsBestSeller
            })
            .OrderBy(product => product.StockQuantity > 0 ? 0 : 1) // stable: keeps the catalogue order otherwise
            .ToList();

    private async Task<List<StorefrontProductDTO>> MapProductsAsync(List<backend.Models.Product> entities)
    {
        var products = entities.Select(product => new StorefrontProductDTO
        {
            Id = product.Id,
            ProductName = product.ProductName,
            Description = product.Description,
            CategoryId = product.CategoryId,
            CategoryName = product.Category?.Name,
            Price = SalePricing.Price(product.Price),
            OriginalPrice = SalePricing.Price(product.Price),
            UnitName = product.Unit?.Name,
            StockQuantity = product.StockQuantity,
            ImageUrl = product.ImageUrl
        }).ToList();
        var promotions = await repository.GetActiveProductPromotionsAsync(
            products.Select(product => product.Id).ToList(), DateTimeHelper.VietnamToday);
        foreach (var product in products)
        {
            var best = promotions.Where(promotion => promotion.ProductId == product.Id)
                .Select(promotion => new
                {
                    Promotion = promotion,
                    Discount = promotion.Promotion == null ? 0 : SalePricing.Discount(promotion.Promotion, product.OriginalPrice)
                })
                .OrderByDescending(item => item.Discount)
                .FirstOrDefault();
            if (best == null || best.Discount <= 0) continue;
            product.Price = Math.Max(0, product.OriginalPrice - best.Discount);
            product.PromotionName = best.Promotion.Promotion?.Name;
            product.DiscountAmount = best.Discount;
            product.DiscountPercent = product.OriginalPrice == 0 ? 0 : Math.Round(best.Discount / product.OriginalPrice * 100, 0);
            product.PromotionEndsAt = best.Promotion.Promotion?.EndDate;
        }
        return products;
    }

    public async Task<List<StorefrontCategoryDTO>> GetActiveCategoriesAsync()
    {
        var (categories, _) = await categoryCache.GetOrCreateAsync(async () =>
        {
            var loaded = await repository.GetActiveCategoriesAsync();
            return loaded.Select(category => new StorefrontCategoryDTO { Id = category.Id, Name = category.Name }).ToList();
        }, CacheTtl);
        return categories.ToList();
    }
}
