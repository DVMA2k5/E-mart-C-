using backend.Data;
using backend.Models;
using backend.Helpers;
using Microsoft.EntityFrameworkCore;

namespace backend.Repository
{
    public class PromotionRepository
    {
        private readonly AppDbContext _context;

        public PromotionRepository(AppDbContext context)
        {
            _context = context;
        }

        // Get all promotions
        public async Task<List<Promotion>> GetAllAsync()
        {
            var promotions = await PromotionsWithDetails()
                .AsNoTracking()
                .Where(p => !p.IsDeleted)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return PopulateDiscountFields(promotions);
        }

        // Get paginated promotions with search and filter
        public async Task<PaginationResult<Promotion>> GetPaginatedAsync(
            int page, 
            int pageSize, 
            string? search = null, 
            string? status = null, 
            string? type = null)
        {
            if (page < 1) page = 1;
            if (pageSize <= 0) pageSize = 20;

            var query = PromotionsWithDetails()
                .AsNoTracking()
                .Where(p => !p.IsDeleted);

            // Search by code
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(p => p.Code.ToLower().Contains(search.ToLower()));
            }

            // Filter by type
            if (!string.IsNullOrWhiteSpace(type) && type != "all")
            {
                query = type is "event" or "voucher" or "product"
                    ? query.Where(p => p.PromotionKind == type)
                    : type == "fixed"
                        ? query.Where(p =>
                        (p.PromotionKind == "event" && p.EventPromotion != null && p.EventPromotion.DiscountPercent == 0 && p.EventPromotion.MaxDiscountAmount > 0) ||
                        (p.PromotionKind == "voucher" && p.VoucherPromotion != null && p.VoucherPromotion.DiscountPercent == 0 && p.VoucherPromotion.MaxDiscountAmount > 0))
                        : query.Where(p =>
                        (p.PromotionKind == "event" && p.EventPromotion != null && p.EventPromotion.DiscountPercent > 0) ||
                        (p.PromotionKind == "voucher" && p.VoucherPromotion != null && p.VoucherPromotion.DiscountPercent > 0) ||
                        (p.PromotionKind == "product" && p.ProductPromotions.Any(detail => detail.DiscountPercent > 0)));
            }

            // Filter by status - sử dụng DateTimeHelper để thống nhất timezone
            var vnToday = DateTimeHelper.VietnamToday;
            if (!string.IsNullOrWhiteSpace(status) && status != "all")
            {
                query = status switch
                {
                    "active" => query.Where(p => p.Status == "active" &&
                        (!p.StartDate.HasValue || p.StartDate.Value.Date <= vnToday) &&
                        (!p.EndDate.HasValue || p.EndDate.Value.Date >= vnToday) &&
                        (!p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit)),
                    "inactive" => query.Where(p => p.Status == "disabled"),
                    "expired" => query.Where(p => p.Status == "expired" || (p.EndDate.HasValue && p.EndDate.Value.Date < vnToday)),
                    "scheduled" => query.Where(p => p.Status == "active" &&
                        p.StartDate.HasValue && p.StartDate.Value.Date > vnToday &&
                        (!p.EndDate.HasValue || p.EndDate.Value.Date >= vnToday) &&
                        (!p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit)),
                    _ => query
                };
            }

            var totalItems = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalItems / pageSize);

            var items = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            PopulateDiscountFields(items);

            return new PaginationResult<Promotion>
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

        // Get promotion by ID
        public async Task<Promotion?> GetByIdAsync(int id)
        {
            var promotion = await PromotionsWithDetails()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            return promotion == null ? null : PopulateDiscountFields(new List<Promotion> { promotion }).Single();
        }

        // Get promotion by code
        public async Task<Promotion?> GetByCodeAsync(string code)
        {
            var promotion = await PromotionsWithDetails()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Code.ToUpper() == code.ToUpper() && !p.IsDeleted);

            return promotion == null ? null : PopulateDiscountFields(new List<Promotion> { promotion }).Single();
        }

        // Create promotion
        public async Task<Promotion> CreateAsync(Promotion promotion)
        {
            promotion.CreatedAt = DateTimeHelper.UtcNow;
            promotion.UpdatedAt = DateTimeHelper.UtcNow;

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.Promotions.Add(promotion);
                await _context.SaveChangesAsync();
                AddPromotionDetail(promotion);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return promotion;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Update promotion
        public async Task<Promotion> UpdateAsync(Promotion promotion)
        {
            var existing = await PromotionsWithDetails()
                .FirstOrDefaultAsync(p => p.Id == promotion.Id);
            if (existing == null)
                throw new ArgumentException("Promotion not found", nameof(promotion.Id));

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                existing.Code = promotion.Code;
                existing.Name = string.IsNullOrWhiteSpace(promotion.Name) ? existing.Name : promotion.Name;
                existing.PromotionKind = promotion.PromotionKind;
                existing.MaxDiscount = promotion.MaxDiscount;
                existing.StartDate = promotion.StartDate ?? existing.StartDate;
                existing.EndDate = promotion.EndDate ?? existing.EndDate;
                existing.UsageLimit = promotion.UsageLimit;
                existing.UsedCount = promotion.UsedCount;
                existing.Status = promotion.Status;
                existing.Description = promotion.Description;
                existing.UpdatedAt = DateTimeHelper.UtcNow;
                existing.Type = promotion.Type;
                existing.Value = promotion.Value;
                existing.MinOrderAmount = promotion.MinOrderAmount;
                existing.ProductIds = promotion.ProductIds;
                existing.VoucherCode = promotion.VoucherCode;

                if (existing.EventPromotion != null)
                    _context.EventPromotions.Remove(existing.EventPromotion);
                if (existing.VoucherPromotion != null)
                    _context.VoucherPromotions.Remove(existing.VoucherPromotion);
                _context.ProductPromotions.RemoveRange(existing.ProductPromotions);

                existing.EventPromotion = null;
                existing.VoucherPromotion = null;
                existing.ProductPromotions.Clear();
                await _context.SaveChangesAsync();

                AddPromotionDetail(existing);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return existing;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Soft delete promotion
        public async Task<bool> DeleteAsync(int id)
        {
            var promotion = await _context.Promotions.FirstOrDefaultAsync(p => p.Id == id);
            if (promotion == null) return false;

            promotion.IsDeleted = true;
            promotion.DeletedAt = DateTimeHelper.UtcNow;
            _context.Promotions.Update(promotion);
            await _context.SaveChangesAsync();
            return true;
        }

        // Get active promotions
        public async Task<List<Promotion>> GetActivePromotionsAsync()
        {
            var vnToday = DateTimeHelper.VietnamToday;
            var promotions = await PromotionsWithDetails()
                .AsNoTracking()
                .Where(p => !p.IsDeleted &&
                           p.Status == "active" &&
                           (!p.StartDate.HasValue || p.StartDate.Value.Date <= vnToday) &&
                           (!p.EndDate.HasValue || p.EndDate.Value.Date >= vnToday) &&
                           (!p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit))
                .ToListAsync();

            return PopulateDiscountFields(promotions);
        }

        private IQueryable<Promotion> PromotionsWithDetails()
        {
            return _context.Promotions
                .Include(p => p.EventPromotion)
                .Include(p => p.VoucherPromotion)
                .Include(p => p.ProductPromotions);
        }

        private static List<Promotion> PopulateDiscountFields(List<Promotion> promotions)
        {
            foreach (var promotion in promotions)
            {
                promotion.Active = promotion.Status != "disabled";
                promotion.ProductIds = promotion.ProductPromotions.Select(detail => detail.ProductId).ToList();
                promotion.VoucherCode = promotion.VoucherPromotion?.VoucherCode;

                var percentage = promotion.PromotionKind switch
                {
                    "event" => promotion.EventPromotion?.DiscountPercent,
                    "voucher" => promotion.VoucherPromotion?.DiscountPercent,
                    "product" => promotion.ProductPromotions.FirstOrDefault()?.DiscountPercent,
                    _ => null
                };

                var detailMaxDiscount = promotion.PromotionKind switch
                {
                    "event" => promotion.EventPromotion?.MaxDiscountAmount,
                    "voucher" => promotion.VoucherPromotion?.MaxDiscountAmount,
                    _ => null
                };

                promotion.MinOrderAmount = promotion.PromotionKind == "event"
                    ? promotion.EventPromotion?.MinOrderAmount ?? 0
                    : 0;
                promotion.MaxDiscount = detailMaxDiscount ?? promotion.MaxDiscount;
                promotion.Type = percentage.GetValueOrDefault() > 0 ? "percent" : "fixed";
                promotion.Value = promotion.Type == "percent"
                    ? percentage.GetValueOrDefault()
                    : detailMaxDiscount ?? 0;
            }

            return promotions;
        }

        private void AddPromotionDetail(Promotion promotion)
        {
            switch (promotion.PromotionKind)
            {
                case "event":
                    promotion.EventPromotion = new EventPromotion
                    {
                        PromotionId = promotion.Id,
                        MinOrderAmount = promotion.MinOrderAmount,
                        DiscountPercent = promotion.Type == "percent" ? promotion.Value : 0,
                        MaxDiscountAmount = promotion.Type == "fixed" ? promotion.Value : promotion.MaxDiscount
                    };
                    _context.EventPromotions.Add(promotion.EventPromotion);
                    break;

                case "voucher":
                    promotion.VoucherPromotion = new VoucherPromotion
                    {
                        PromotionId = promotion.Id,
                        VoucherCode = string.IsNullOrWhiteSpace(promotion.VoucherCode) ? promotion.Code : promotion.VoucherCode,
                        DiscountPercent = promotion.Type == "percent" ? promotion.Value : 0,
                        MaxDiscountAmount = promotion.Type == "fixed" ? promotion.Value : promotion.MaxDiscount,
                        UsageLimit = promotion.UsageLimit,
                        UsedCount = promotion.VoucherPromotion?.UsedCount ?? promotion.UsedCount
                    };
                    _context.VoucherPromotions.Add(promotion.VoucherPromotion);
                    break;

                case "product":
                    var productIds = promotion.ProductIds.Distinct().ToList();
                    if (productIds.Count == 0)
                        throw new ArgumentException("At least one product is required for a product promotion");

                    promotion.ProductPromotions = productIds.Select(productId => new ProductPromotion
                    {
                        PromotionId = promotion.Id,
                        ProductId = productId,
                        DiscountPercent = promotion.Value
                    }).ToList();
                    _context.ProductPromotions.AddRange(promotion.ProductPromotions);
                    break;

                default:
                    throw new ArgumentException("Promotion kind must be event, voucher, or product");
            }
        }

        // Get redemptions for a promotion
        public async Task<List<PromotionRedemption>> GetRedemptionsAsync(int promotionId)
        {
            return await _context.PromotionRedemptions
                .AsNoTracking()
                .Where(pr => pr.PromotionId == promotionId)
                .Include(pr => pr.Customer)
                .Include(pr => pr.Order)
                .OrderByDescending(pr => pr.RedeemedAt)
                .ToListAsync();
        }

        // Increment used count
        public async Task<bool> IncrementUsedCountAsync(int promotionId)
        {
            var promotion = await _context.Promotions.FindAsync(promotionId);
            if (promotion == null) return false;

            promotion.UsedCount++;
            promotion.UpdatedAt = DateTimeHelper.UtcNow;

            if (promotion.PromotionKind == "voucher")
            {
                var voucher = await _context.VoucherPromotions
                    .FirstOrDefaultAsync(detail => detail.PromotionId == promotionId);
                if (voucher != null)
                    voucher.UsedCount++;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        // Add redemption record
        public async Task<PromotionRedemption> AddRedemptionAsync(PromotionRedemption redemption)
        {
            redemption.RedeemedAt = DateTimeHelper.UtcNow;
            _context.PromotionRedemptions.Add(redemption);
            await _context.SaveChangesAsync();
            return redemption;
        }

        /// <summary>
        /// Áp dụng khuyến mãi cho một đơn hàng đã tạo (alternative method for POS)
        /// </summary>
        public async Task ApplyPromotionAsync(Order order)
        {
            if (!order.PromotionId.HasValue) return;

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var promo = await GetByIdAsync(order.PromotionId.Value);
                if (promo == null)
                    throw new Exception("Khuyến mãi không tồn tại");

                if (promo.UsageLimit.HasValue && promo.UsedCount >= promo.UsageLimit.Value)
                    throw new Exception("Khuyến mãi đã hết lượt sử dụng");

                promo.UsedCount += 1;
                _context.Promotions.Update(promo);

                var redemption = new PromotionRedemption
                {
                    PromotionId = promo.Id,
                    CustomerId = order.CustomerId,
                    OrderId = order.Id,
                    RedeemedAt = DateTimeHelper.UtcNow
                };
                await _context.PromotionRedemptions.AddAsync(redemption);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}