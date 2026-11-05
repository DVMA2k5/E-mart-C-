using backend.Data;
using backend.DTO;
using backend.Models;
using backend.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;
using backend.Services;

namespace backend.Repository
{
    public class PromotionRepository
    {
        private readonly AppDbContext _context;

        public PromotionRepository(AppDbContext context)
        {
            _context = context;
        }

        public Task<IDbContextTransaction> BeginSerializableTransactionAsync() =>
            _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        public Task<Promotion?> GetForUpdateAsync(int id) => _context.Promotions
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        public Task<Order?> GetOrderForUpdateAsync(int orderId) => _context.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId);

        public Task<bool> HasRedemptionAsync(int promotionId, int orderId) =>
            _context.PromotionRedemptions.AnyAsync(r => r.PromotionId == promotionId && r.OrderId == orderId);

        public void AddRedemption(PromotionRedemption redemption) =>
            _context.PromotionRedemptions.Add(redemption);

        public Task SaveChangesAsync() => _context.SaveChangesAsync();

        public Task<Order?> GetOrderByIdAsync(int orderId) => _context.Orders
            .Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        // Get all promotions
        public async Task<List<Promotion>> GetAllAsync()
        {
            var promotions = await PromotionsWithDetails()
                .AsNoTracking()
                .Where(p => !p.IsDeleted)
                .Include(p => p.EventDetails).Include(p => p.VoucherDetails).Include(p => p.ProductDetails)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return PopulateDiscountFields(promotions);
        }

        // Get promotion by ID
        public async Task<Promotion?> GetByIdAsync(int id)
        {
            var promotion = await PromotionsWithDetails()
                .AsNoTracking()
                .Include(p => p.EventDetails).Include(p => p.VoucherDetails).Include(p => p.ProductDetails)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            return promotion == null ? null : PopulateDiscountFields(new List<Promotion> { promotion }).Single();
        }

        // Get promotion by code
        public async Task<Promotion?> GetByCodeAsync(string code)
        {
            var promotion = await PromotionsWithDetails()
                .AsNoTracking()
                .Include(p => p.EventDetails).Include(p => p.VoucherDetails).Include(p => p.ProductDetails)
                .FirstOrDefaultAsync(p => p.VoucherDetails != null &&
                    p.VoucherDetails.VoucherCode.ToUpper() == code.Trim().ToUpper() && !p.IsDeleted);
            return promotion == null ? null : PopulateDiscountFields(new List<Promotion> { promotion }).Single();
        }

        public async Task<List<ProductPromotionAvailabilityDTO>> GetProductSelectionLocksAsync(
            DateTime startDate,
            DateTime endDate,
            int? excludePromotionId = null)
        {
            var today = DateTimeHelper.VietnamToday;
            return await (
                from link in _context.ProductPromotions.AsNoTracking()
                join promotion in _context.Promotions.AsNoTracking() on link.PromotionId equals promotion.Id
                where !promotion.IsDeleted
                      && promotion.Type == "product"
                      && promotion.Status == "active"
                      && (!excludePromotionId.HasValue || promotion.Id != excludePromotionId.Value)
                      && (!promotion.EndDate.HasValue || promotion.EndDate.Value.Date >= today)
                      && (!promotion.StartDate.HasValue || promotion.StartDate.Value.Date <= endDate.Date)
                      && (!promotion.EndDate.HasValue || promotion.EndDate.Value.Date >= startDate.Date)
                select new ProductPromotionAvailabilityDTO
                {
                    ProductId = link.ProductId,
                    PromotionId = promotion.Id,
                    PromotionName = promotion.Name,
                    EndDate = promotion.EndDate
                }
            ).ToListAsync();
        }

        // Create promotion
        public async Task<Promotion> CreateAsync(Promotion promotion)
        {
            promotion.CreatedAt = DateTimeHelper.UtcNow;
            promotion.UpdatedAt = DateTimeHelper.UtcNow;

            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                await VoucherWalletService.LockAsync(_context);
                VoucherWalletService.ValidateConfiguration(promotion);
                if (promotion.Type == "voucher" && !promotion.VoucherDetails!.ClaimLimit.HasValue)
                    throw new ArgumentException("Vui lòng nhập tổng số voucher cho phép nhận.");
                if (promotion.Type == "voucher" && await _context.VoucherPromotions.AnyAsync(v => v.VoucherCode == promotion.VoucherDetails!.VoucherCode))
                    throw new ArgumentException("Mã voucher đã tồn tại. Vui lòng chọn mã khác.");
                _context.Promotions.Add(promotion);
                await _context.SaveChangesAsync();
                if (promotion.VoucherDetails is { SendToCustomers: true } voucher)
                {
                    if (promotion.Status != "active" || promotion.EndDate?.Date < DateTimeHelper.VietnamToday || voucher.ClaimEndDate?.Date < DateTimeHelper.VietnamToday)
                        throw new ArgumentException("Chỉ cấp sẵn voucher đang hoạt động và chưa hết hạn nhận.");
                    var customerIds = await _context.Customers.Where(c => c.IsActive).Select(c => c.Id).ToListAsync();
                    if (voucher.ClaimLimit.HasValue && voucher.ClaimLimit < customerIds.Count)
                        throw new ArgumentException($"Giới hạn nhận phải từ {customerIds.Count} để cấp cho tất cả khách hàng hiện có.");
                    _context.CustomerVouchers.AddRange(customerIds.Select(id => new CustomerVoucher
                    { PromotionId = promotion.Id, CustomerId = id, ClaimedAt = DateTime.UtcNow, Source = "admin" }));
                    voucher.ClaimedCount = customerIds.Count;
                    await _context.SaveChangesAsync();
                }
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
            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            await VoucherWalletService.LockAsync(_context);
            var existing = await _context.Promotions
                .Include(p => p.EventDetails).Include(p => p.VoucherDetails).Include(p => p.ProductDetails)
                .FirstOrDefaultAsync(p => p.Id == promotion.Id);
            if (existing == null) throw new InvalidOperationException("Promotion not found");
            var previousVoucher = existing.VoucherDetails;
            if (previousVoucher is { ClaimedCount: > 0 })
            {
                if (promotion.Type != "voucher" || promotion.VoucherDetails == null ||
                    previousVoucher.VoucherCode != promotion.VoucherDetails.VoucherCode ||
                    previousVoucher.Visibility != promotion.VoucherDetails.Visibility ||
                    existing.Value != promotion.Value || existing.DiscountType != promotion.DiscountType || existing.MaxDiscount != promotion.MaxDiscount)
                    throw new ArgumentException("Voucher đã có người nhận: không thể đổi loại, mã, hình thức công khai hoặc giá trị giảm.");
                if (promotion.EndDate < existing.EndDate)
                    throw new ArgumentException("Không thể rút ngắn hạn sử dụng của voucher đã có người nhận.");
            }
            if (promotion.VoucherDetails != null)
            {
                promotion.VoucherDetails.ClaimedCount = previousVoucher?.ClaimedCount ?? 0;
                promotion.VoucherDetails.SendToCustomers = previousVoucher?.SendToCustomers ?? false;
                if (promotion.VoucherDetails.ClaimLimit < promotion.VoucherDetails.ClaimedCount)
                    throw new ArgumentException("Giới hạn nhận không được nhỏ hơn số voucher đã nhận.");
                if (await _context.VoucherPromotions.AnyAsync(v => v.PromotionId != promotion.Id && v.VoucherCode == promotion.VoucherDetails.VoucherCode))
                    throw new ArgumentException("Mã voucher đã tồn tại. Vui lòng chọn mã khác.");
            }
            VoucherWalletService.ValidateConfiguration(promotion);
            promotion.UsedCount = existing.UsedCount;

            var requestedProductDetails = (promotion.ProductDetails ?? Array.Empty<ProductPromotion>())
                .GroupBy(detail => detail.ProductId)
                .ToDictionary(group => group.Key, group => group.First());
            existing.ProductDetails ??= new List<ProductPromotion>();

            foreach (var current in existing.ProductDetails
                         .Where(detail => !requestedProductDetails.ContainsKey(detail.ProductId)).ToList())
                _context.ProductPromotions.Remove(current);

            foreach (var requested in requestedProductDetails.Values)
            {
                var current = existing.ProductDetails.FirstOrDefault(detail => detail.ProductId == requested.ProductId);
                if (current is not null)
                {
                    current.DiscountPercent = requested.DiscountPercent;
                    continue;
                }

                existing.ProductDetails.Add(new ProductPromotion
                {
                    PromotionId = existing.Id,
                    ProductId = requested.ProductId,
                    DiscountPercent = requested.DiscountPercent
                });
            }

            if (existing.EventDetails != null) _context.EventPromotions.Remove(existing.EventDetails);
            if (existing.VoucherDetails != null) _context.VoucherPromotions.Remove(existing.VoucherDetails);
            _context.Entry(existing).CurrentValues.SetValues(promotion);
            existing.EventDetails = promotion.EventDetails;
            existing.VoucherDetails = promotion.VoucherDetails;
            promotion.UpdatedAt = DateTimeHelper.UtcNow;
            existing.UpdatedAt = promotion.UpdatedAt;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return existing;
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
                .Include(p => p.EventDetails).Include(p => p.VoucherDetails).Include(p => p.ProductDetails)
                .Where(p => !p.IsDeleted &&
                           p.Status == "active" && p.Type != "product" &&
                           (!p.StartDate.HasValue || p.StartDate.Value.Date <= vnToday) &&
                           (!p.EndDate.HasValue || p.EndDate.Value.Date >= vnToday) &&
                           (p.Type == "voucher" || !p.UsageLimit.HasValue || p.UsedCount < p.UsageLimit))
                .ToListAsync();

            return PopulateDiscountFields(promotions);
        }

        private IQueryable<Promotion> PromotionsWithDetails()
        {
            return _context.Promotions
                .Include(p => p.EventDetails)
                .Include(p => p.VoucherDetails)
                .Include(p => p.ProductDetails);
        }

        private static List<Promotion> PopulateDiscountFields(List<Promotion> promotions)
        {
            foreach (var promotion in promotions)
            {
                promotion.Active = promotion.Status == "active";
                promotion.ProductIds = promotion.ProductDetails?.Select(detail => detail.ProductId).ToList() ?? new List<int>();
                promotion.VoucherCode = promotion.VoucherDetails?.VoucherCode;
                promotion.MinOrderAmount = promotion.EventDetails?.MinOrderAmount ?? 0;
            }

            return promotions;
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

        public Task<List<PromotionRedemption>> GetCustomerRedemptionsAsync(int customerId) =>
            _context.PromotionRedemptions.AsNoTracking()
                .Where(redemption => redemption.CustomerId == customerId)
                .Include(redemption => redemption.Promotion).ThenInclude(promotion => promotion!.VoucherDetails)
                .Include(redemption => redemption.Order)
                .OrderByDescending(redemption => redemption.RedeemedAt)
                .ToListAsync();

    }
}
