using System.Data;
using backend.Data;
using backend.DTO;
using backend.Helpers;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public sealed class VoucherWalletService(AppDbContext db, BusMemoryCache<PromotionDTO> cache)
{
    // Every claim/configuration/reservation uses the same transaction lock across API processes.
    public static Task LockAsync(AppDbContext context) => context.Database.ExecuteSqlRawAsync("""
        DECLARE @result INT;
        EXEC @result = sys.sp_getapplock @Resource = 'voucher-wallet', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @result < 0 THROW 51000, 'Voucher is busy. Please retry.', 1;
        """);

    public Task LockAsync() => LockAsync(db);

    public static void ValidateConfiguration(Promotion promotion)
    {
        if (promotion.Type != "voucher") return;
        var v = promotion.VoucherDetails ?? throw new ArgumentException("Vui lòng nhập mã voucher.");
        if (v.Visibility is not ("public" or "only-code")) throw new ArgumentException("Loại voucher phải là Public hoặc Only-code.");
        if (v.SendToCustomers && v.Visibility != "public") throw new ArgumentException("Only-code không thể tự cấp cho tất cả khách hàng.");
        if (v.ClaimLimit is <= 0) throw new ArgumentException("Tổng số voucher cho phép nhận phải lớn hơn 0.");
        if (v.ClaimStartDate == null || v.ClaimEndDate == null || promotion.EndDate == null)
            throw new ArgumentException("Vui lòng nhập thời gian nhận mã và hạn sử dụng.");
        if (v.ClaimStartDate.Value.Date > v.ClaimEndDate.Value.Date || v.ClaimEndDate.Value.Date > promotion.EndDate.Value.Date)
            throw new ArgumentException("Ngày bắt đầu nhận ≤ ngày kết thúc nhận ≤ ngày hết hạn sử dụng.");
    }

    public static string? ClaimIssue(Promotion p)
    {
        var v = p.VoucherDetails;
        var today = DateTimeHelper.VietnamToday;
        if (p.IsDeleted || p.Status != "active" || v == null) return "Voucher đã bị vô hiệu.";
        if (p.EndDate?.Date < today) return "Voucher đã hết hạn.";
        if (v.ClaimStartDate?.Date > today) return "Chưa đến thời gian nhận mã.";
        if (v.ClaimEndDate?.Date < today) return "Đã hết thời gian nhận mã.";
        if (v.ClaimLimit.HasValue && v.ClaimedCount >= v.ClaimLimit) return "Mã đã hết lượt";
        return null;
    }

    public static string Status(CustomerVoucher claim)
    {
        if (claim.UsedAt.HasValue) return "used";
        if (claim.Promotion.EndDate?.Date < DateTimeHelper.VietnamToday) return "expired";
        if (claim.OrderId.HasValue && claim.Order?.Status is not ("cancelled" or "refunded")) return "reserved";
        if (claim.Promotion.IsDeleted || claim.Promotion.Status != "active") return "disabled";
        if (claim.Promotion.StartDate?.Date > DateTimeHelper.VietnamToday) return "scheduled";
        return "available";
    }

    private static PromotionDTO MapClaim(CustomerVoucher claim)
    {
        var result = PromotionService.MapToDTO(claim.Promotion);
        result.IsClaimed = true;
        result.ClaimId = claim.Id;
        result.ClaimedAt = claim.ClaimedAt;
        result.UsedAt = claim.UsedAt;
        result.WalletStatus = Status(claim);
        result.ReservedOrderId = result.WalletStatus == "reserved" ? claim.OrderId : null;
        result.OrderNumber = claim.Order?.OrderNumber;
        return result;
    }

    public async Task<List<PromotionDTO>> DiscoverAsync(int customerId)
    {
        var today = DateTimeHelper.VietnamToday;
        var promotions = await db.Promotions.AsNoTracking().Include(p => p.VoucherDetails)
            .Where(p => p.Type == "voucher" && p.Status == "active" && p.VoucherDetails!.Visibility == "public" &&
                p.VoucherDetails.ClaimStartDate <= today && p.VoucherDetails.ClaimEndDate >= today && p.EndDate >= today)
            .OrderBy(p => p.VoucherDetails!.ClaimEndDate).ToListAsync();
        var owned = await db.CustomerVouchers.Where(c => c.CustomerId == customerId).Select(c => c.PromotionId).ToListAsync();
        var ids = owned.ToHashSet();
        return promotions.Select(p => { var dto = PromotionService.MapToDTO(p); dto.IsClaimed = ids.Contains(p.Id); return dto; }).ToList();
    }

    public async Task<List<PromotionDTO>> WalletAsync(int customerId) => (await db.CustomerVouchers
        .IgnoreQueryFilters().AsNoTracking().Include(c => c.Promotion).ThenInclude(p => p.VoucherDetails)
        .Include(c => c.Order).Where(c => c.CustomerId == customerId)
        .OrderByDescending(c => c.ClaimedAt).ToListAsync()).Select(MapClaim).ToList();

    public async Task<PromotionDTO> ClaimAsync(int customerId, int? promotionId, string? code)
    {
        if (promotionId.HasValue == !string.IsNullOrWhiteSpace(code))
            throw new BusinessRuleException("Chọn voucher hoặc nhập một mã để nhận.");
        var normalized = code?.Trim().ToUpperInvariant();
        if (normalized?.Length > 50) throw new BusinessRuleException("Mã voucher không hợp lệ.");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await LockAsync();
        if (!await db.Customers.AnyAsync(c => c.Id == customerId && c.IsActive))
            throw new BusinessRuleException("Tài khoản khách hàng không hợp lệ.", 401);
        var promotion = await db.Promotions.Include(p => p.VoucherDetails).SingleOrDefaultAsync(p => p.Type == "voucher" &&
            (promotionId.HasValue ? p.Id == promotionId && p.VoucherDetails!.Visibility == "public" : p.VoucherDetails!.VoucherCode == normalized));
        if (promotion == null) throw new BusinessRuleException("Mã voucher không tồn tại.", 404);
        if (await db.CustomerVouchers.AnyAsync(c => c.CustomerId == customerId && c.PromotionId == promotion.Id))
            throw new BusinessRuleException("Bạn đã nhận mã này.", 409);
        var issue = ClaimIssue(promotion);
        if (issue != null) throw new BusinessRuleException(issue, 409);
        var claim = new CustomerVoucher { Promotion = promotion, CustomerId = customerId,
            ClaimedAt = DateTime.UtcNow, Source = promotionId.HasValue ? "public" : "code" };
        db.CustomerVouchers.Add(claim);
        promotion.VoucherDetails!.ClaimedCount++;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        cache.Clear();
        return MapClaim(claim);
    }

    // Called within the checkout transaction, before committing the discounted order.
    public async Task ReserveAsync(int promotionId, int? customerId, Order order)
    {
        if (!customerId.HasValue) throw new BusinessRuleException("Chọn khách hàng đã nhận voucher để sử dụng.", 400, true);
        await LockAsync();
        var claim = await db.CustomerVouchers.Include(c => c.Promotion).Include(c => c.Order)
            .SingleOrDefaultAsync(c => c.PromotionId == promotionId && c.CustomerId == customerId);
        if (claim == null) throw new BusinessRuleException("Vui lòng nhận voucher vào kho trước khi sử dụng.", 400, true);
        var status = Status(claim);
        if (claim.OrderId == order.Id && order.Id > 0) return; // Reapplying the same order is idempotent.
        if (status == "used") throw new BusinessRuleException("Bạn đã sử dụng voucher này.", 409, true);
        if (status == "reserved" && claim.OrderId != order.Id)
            throw new BusinessRuleException("Voucher đang được sử dụng cho một đơn hàng khác.", 409, true);
        if (status is "disabled" or "expired" or "scheduled")
            throw new BusinessRuleException("Voucher chưa có hiệu lực, đã hết hạn hoặc bị vô hiệu.", 409, true);
        claim.Order = order;
    }

    public async Task<string?> UsageIssueAsync(int promotionId, int customerId)
    {
        var claim = await db.CustomerVouchers.AsNoTracking().Include(c => c.Promotion).Include(c => c.Order)
            .SingleOrDefaultAsync(c => c.PromotionId == promotionId && c.CustomerId == customerId);
        return claim == null ? "Vui lòng nhận voucher vào kho trước khi sử dụng." : Status(claim) switch
        {
            "available" => null,
            "used" => "Bạn đã sử dụng voucher này.",
            "reserved" => "Voucher đang được sử dụng cho một đơn hàng khác.",
            _ => "Voucher chưa có hiệu lực, đã hết hạn hoặc bị vô hiệu."
        };
    }

    // Invoice lifecycle is shared by POS, online, COD and payment callbacks.
    public async Task SyncOrderAsync(int orderId)
    {
        await using var ownTransaction = db.Database.CurrentTransaction == null
            ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable) : null;
        await LockAsync();
        var claim = await db.CustomerVouchers.IgnoreQueryFilters().Include(c => c.Order).Include(c => c.Promotion)
            .SingleOrDefaultAsync(c => c.OrderId == orderId);
        if (claim != null && !claim.UsedAt.HasValue)
        {
            if (claim.Order?.Status == "cancelled") { claim.OrderId = null; claim.Order = null; }
            else if (claim.Order?.Status == "completed")
            {
                claim.UsedAt = DateTime.UtcNow;
                claim.Promotion.UsedCount++;
                if (!await db.PromotionRedemptions.AnyAsync(r => r.OrderId == orderId && r.PromotionId == claim.PromotionId))
                    db.PromotionRedemptions.Add(new PromotionRedemption { PromotionId = claim.PromotionId,
                        CustomerId = claim.CustomerId, OrderId = orderId, RedeemedAt = claim.UsedAt.Value });
            }
            await db.SaveChangesAsync();
            cache.Clear();
        }
        if (ownTransaction != null) await ownTransaction.CommitAsync();
    }
}
