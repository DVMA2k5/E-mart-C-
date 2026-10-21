using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using backend.Data;
using backend.DTO;
using backend.Helpers;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Repository
{
    public class ProductRepository
    {
        private readonly AppDbContext _context;

        public ProductRepository(AppDbContext context)
        {
            _context = context;
        }



        // Lấy theo id (include liên quan)
        public async Task<Product?> GetByIdAsync(int id)
        {
            return await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .Include(p => p.Unit)
                .Include(p => p.Inventory)
                .Include(p => p.OrderItems) // nếu cần thống kê
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task<Product?> GetByIdForUpdateAsync(int id)
        {
            return await _context.Products
                .AsNoTracking() // tránh tracking conflict
                .Select(p => new Product
                {
                    Id = p.Id,
                    CreatedAt = p.CreatedAt
                })
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        // Lấy theo SKU (dùng cho import)
        public async Task<Product?> GetBySkuAsync(string? sku)
        {
            if (string.IsNullOrWhiteSpace(sku))
                return null;

            return await _context.Products
                .FirstOrDefaultAsync(p => p.Sku == sku);
        }



        public async Task<Product> CreateAsync(Product product)
        {
            // đảm bảo timestamp nếu cần
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            return product;
        }

        public async Task<Product> UpdateAsync(Product product)
        {
            product.UpdatedAt = DateTime.UtcNow;
            _context.Products.Update(product);
            await _context.SaveChangesAsync();
            return product;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null) return false;


            product.IsActive = !product.IsActive;
            product.UpdatedAt = DateTime.UtcNow;

            _context.Products.Update(product);
            await _context.SaveChangesAsync();
            return true;
        }


        // Filtered with pagination and sorting
        public async Task<PaginationResult<Product>> GetFilteredAsync(
            int page = 1,
            int pageSize = 12,
            int? supplierId = null,
            int? categoryId = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            string? sortBy = "",
            string? search = null,
            int? status = null,
            string? stockStatus = null)
        {
            if (page < 1) page = 1;
            if (pageSize <= 0) pageSize = 10;

            IQueryable<Product> query = _context.Products
                .AsQueryable()
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .Include(p => p.Unit)
                .Include(p => p.Inventory);

            // Filter supplier
            if (supplierId.HasValue)
                query = query.Where(p => p.SupplierId == supplierId.Value);

            // Filter category
            if (categoryId.HasValue)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            // Price range
            if (minPrice.HasValue)
                query = query.Where(p => p.Price >= minPrice.Value);

            if (maxPrice.HasValue)
                query = query.Where(p => p.Price <= maxPrice.Value);

            if (status.HasValue)
                query = query.Where(p => p.IsActive == (status.Value == 1));

            // Stock remains product data, while this endpoint owns the product-list UI.
            if (!string.IsNullOrWhiteSpace(stockStatus))
            {
                query = stockStatus.ToLowerInvariant() switch
                {
                    "available" => query.Where(p => p.Inventory != null && p.Inventory.Quantity > 0),
                    "out_of_stock" => query.Where(p => p.Inventory == null || p.Inventory.Quantity == 0),
                    "low_stock" => query.Where(p => p.Inventory != null && p.Inventory.Quantity > 0 && p.Inventory.Quantity < 10),
                    "in_stock" => query.Where(p => p.Inventory != null && p.Inventory.Quantity >= 10),
                    _ => query
                };
            }

            // Search by product name, sku, barcode, supplier name
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(p =>
                    p.ProductName.Contains(s) ||
                    (p.Sku != null && p.Sku.Contains(s)) ||
                    // (p.Barcode != null && p.Barcode.Contains(s)) ||
                    (p.Supplier != null && p.Supplier.Name.Contains(s))
                );
            }

            // Sort
            query = (sortBy ?? "id").ToLower() switch
            {
                "price_asc" => query.OrderBy(p => p.Price),
                "price_desc" => query.OrderByDescending(p => p.Price),
                "name_asc" => query.OrderBy(p => p.ProductName),
                "name_desc" => query.OrderByDescending(p => p.ProductName),
                "featured" => query.OrderByDescending(p => p.OrderItems.Sum(oi => oi.Quantity)), // best sellers
                "bestsellers" => query.OrderByDescending(p => p.OrderItems.Sum(oi => oi.Quantity)),
                "budget" => query.OrderBy(p => p.Price), // cheapest first
                "newest" => query.OrderByDescending(p => p.CreatedAt),
                "oldest" => query.OrderBy(p => p.CreatedAt),
                "quantity_asc" => query.OrderBy(p => p.Inventory == null ? 0 : p.Inventory.Quantity),
                "quantity_desc" => query.OrderByDescending(p => p.Inventory == null ? 0 : p.Inventory.Quantity),
                "updated_at_desc" => query.OrderByDescending(p => p.Inventory == null ? p.UpdatedAt : p.Inventory.UpdatedAt),
                "updated_at_asc" => query.OrderBy(p => p.Inventory == null ? p.UpdatedAt : p.Inventory.UpdatedAt),
                "id" => query.OrderBy(p => p.Id),
                "id_desc" => query.OrderByDescending(p => p.Id),

                _ => query.OrderBy(p => p.Id)
            };

            var totalItems = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalItems / pageSize);

            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return new PaginationResult<Product>
            {
                Items = items,
                TotalItems = totalItems,
                CurrentPage = page,
                PageSize = pageSize,
                TotalPages = totalPages,
                HasPrevious = page > 1,
                HasNext = page < totalPages
            };
        }
        public async Task<bool> ExistsBySkuAsync(string sku, int? excludeId = null)
        {
            var q = _context.Products.AsQueryable().Where(p => p.Sku == sku);
            if (excludeId.HasValue) q = q.Where(p => p.Id != excludeId.Value);
            return await q.AnyAsync();
        }

        /// <summary>
        /// Returns each product's best active, product-specific discount. This is
        /// deliberately calculated rather than stored on Product: promotions own
        /// discount rules and can start, end, or reach their usage limit at any time.
        /// </summary>
        public async Task<Dictionary<int, (decimal Amount, string Name)>> GetActiveProductDiscountsAsync(
            IEnumerable<ProductDTO> products)
        {
            var productPrices = products
                .Where(product => product.Id > 0 && product.Price > 0)
                .ToDictionary(product => product.Id, product => product.Price);

            if (productPrices.Count == 0)
                return new Dictionary<int, (decimal Amount, string Name)>();

            var today = DateTimeHelper.ToUtc(DateTimeHelper.VietnamToday);
            var tomorrow = today.AddDays(1);
            var promotions = await (
                from link in _context.ProductPromotions.AsNoTracking()
                join promotion in _context.Promotions.AsNoTracking() on link.PromotionId equals promotion.Id
                where productPrices.Keys.Contains(link.ProductId)
                      && !promotion.IsDeleted
                      && promotion.Status == "active"
                      && promotion.Type == "product"
                      && (!promotion.StartDate.HasValue || promotion.StartDate.Value < tomorrow)
                      && (!promotion.EndDate.HasValue || promotion.EndDate.Value >= today)
                      && (!promotion.UsageLimit.HasValue || promotion.UsedCount < promotion.UsageLimit)
                select new { link.ProductId, promotion.Name, promotion.DiscountType, promotion.Value, promotion.MaxDiscount }
            ).ToListAsync();

            return promotions
                .Select(promotion => new
                {
                    promotion.ProductId,
                    promotion.Name,
                    Amount = CalculateDiscount(
                        productPrices[promotion.ProductId],
                        promotion.DiscountType,
                        promotion.Value,
                        promotion.MaxDiscount)
                })
                .Where(promotion => promotion.Amount > 0)
                .GroupBy(promotion => promotion.ProductId)
                .ToDictionary(
                    group => group.Key,
                    group =>
                    {
                        var best = group.OrderByDescending(promotion => promotion.Amount).First();
                        return (best.Amount, best.Name);
                    });
        }

        private static decimal CalculateDiscount(decimal price, string discountType, decimal value, decimal? maxDiscount)
        {
            var discount = discountType == "percent" ? decimal.Floor(price * value / 100m) : value;
            if (maxDiscount.HasValue) discount = Math.Min(discount, maxDiscount.Value);
            return Math.Clamp(discount, 0, price);
        }

        public async Task<List<Product>> GetByIdsAsync(IEnumerable<int> ids)
        {
            if (!ids.Any()) return new List<Product>();

            return await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .Include(p => p.Unit)
                .Include(p => p.Inventory)
                .Where(p => ids.Contains(p.Id))
                .AsNoTracking()
                .ToListAsync();
        }

        // Lấy tất cả products để reindex (batch processing)
        public async Task<List<Product>> GetAllForIndexingAsync(int skip = 0, int take = 500)
        {
            return await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .AsNoTracking()
                .OrderBy(p => p.Id)
                .Skip(skip)
                .Take(take)
                .ToListAsync();
        }

        public async Task<int> GetTotalCountAsync()
        {
            return await _context.Products.CountAsync();
        }

        // LÀM ƠN ĐỪNG XÓA => LẤY DANH SÁCH SẢN PHẨM CÒN HÀNG TRONG CỬA HÀNG
         public async Task<PaginationResult<Product>> GetAvailableProductsPaginatedAsync(int page, int pageSize)
        {
            if (page < 1) page = 1;
            if (pageSize <= 0) pageSize = 20;

            IQueryable<Product> query = _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .Include(p => p.Inventory)
                .Where(p => p.Inventory != null && p.Inventory.Quantity > 0);

            var totalItems = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalItems / pageSize);

            var items = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new PaginationResult<Product>
            {
                Items = items,
                TotalItems = totalItems,
                CurrentPage = page,
                PageSize = pageSize,
                TotalPages = totalPages,
                HasPrevious = page > 1,
                HasNext = page < totalPages
            };
        }

        public async Task<Product?> GetByBarcodeAsync(string barcode)
        {
            if (string.IsNullOrWhiteSpace(barcode))
                return null;

            var clean = barcode.Trim();
            return await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .Include(p => p.Unit)
                .Include(p => p.Inventory)
                .FirstOrDefaultAsync(p => p.Barcode == clean || p.Sku == clean);
        }
    }
}
