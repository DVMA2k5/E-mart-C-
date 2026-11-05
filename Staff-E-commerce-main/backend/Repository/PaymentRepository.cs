using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;

namespace backend.Repository
{
    public class PaymentRepository
    {
        private readonly AppDbContext _context;

        public PaymentRepository(AppDbContext context)
        {
            _context = context;
        }

        // Các phương thức liên quan sẽ được triển khai ở đây.
        // 1. Thêm bản ghi payment mới vào cơ sở dữ liệu
        public async Task<Payment> AddPaymentAsync(Payment payment)
        {
            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();
            return payment;
        }

        // 2. Lấy payment theo Id đơn hàng (OrderId).
        // Một đơn có thể có nhiều lượt thanh toán (mỗi lần bấm "Thanh toán MoMo" tạo một lượt mới).
        // Ưu tiên lượt đã thành công (completed), sau đó tới lượt mới nhất; không dùng FirstOrDefault()
        // không có ORDER BY vì SQL Server có thể trả về một lượt cũ bất kỳ.
        public Task<Payment?> GetByOrderIdAsync(int orderId) => _context.Payments.AsNoTracking()
            .Where(p => p.OrderId == orderId)
            .OrderByDescending(p => p.Status == "completed")
            .ThenByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .FirstOrDefaultAsync();

        // 3. Cập nhật trạng thái thanh toán
        public async Task UpdatePaymentStatusAsync(int paymentId, string status)
        {
            var payment = await _context.Payments.FindAsync(paymentId);
            if (payment != null)
            {
                payment.Status = status;
                await _context.SaveChangesAsync();
            }
        }

        //Lấy max Id
        public int GetMaxId()
        {
            return _context.Payments.Any() 
                ? _context.Payments.Max(p => p.Id) 
                : 0;
        }
        
        public async Task<Payment?> UpdatePaymentAsync(Payment payment)
        {
            var existingPayment = await _context.Payments.FindAsync(payment.Id);
            if (existingPayment == null)
                return null;

            // Cập nhật các trường cần thiết
            existingPayment.OrderId = payment.OrderId;
            existingPayment.Amount = payment.Amount;
            existingPayment.Method = payment.Method;
            existingPayment.TransactionRef = payment.TransactionRef;
            existingPayment.Status = payment.Status;


            await _context.SaveChangesAsync();
            return existingPayment;
        }

        public Task<Payment?> GetByOrderIdAsyncVer2(int orderId) => GetByOrderIdAsync(orderId);

        public Task<bool> IsLockedPosOrderAsync(int orderId)
        {
            return _context.Orders.AnyAsync(o => o.Id == orderId && o.CheckoutKey != null);
        }

        public Task<Order?> GetOrderSnapshotAsync(int orderId)
        {
            return _context.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.Id == orderId);
        }

        public Task<Payment?> GetByTransactionRefAsync(string? transactionRef)
        {
            return _context.Payments.FirstOrDefaultAsync(p => p.TransactionRef == transactionRef);
        }

        public Task<IDbContextTransaction> BeginSerializableTransactionAsync() =>
            _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        public Task LockTransactionAsync(string transactionReference)
        {
            var resource = $"payment-{transactionReference}";
            return _context.Database.ExecuteSqlInterpolatedAsync($"""
                DECLARE @result INT;
                EXEC @result = sys.sp_getapplock @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
                IF @result < 0 THROW 51000, 'Payment is busy. Please retry.', 1;
                """);
        }

        public Task<Payment?> GetForCallbackAsync(string transactionReference) => _context.Payments
            .Include(payment => payment.Order)
            .FirstOrDefaultAsync(payment => payment.TransactionRef == transactionReference);

        public Task SaveChangesAsync() => _context.SaveChangesAsync();

        public async Task MarkPendingPaymentFailedAsync(int paymentId)
        {
            await _context.Payments
                .Where(p => p.Id == paymentId && p.Status == "pending")
                .ExecuteUpdateAsync(update => update.SetProperty(p => p.Status, "failed"));
        }

    
    }
}
