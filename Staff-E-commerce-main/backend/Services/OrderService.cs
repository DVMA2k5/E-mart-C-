using backend.Models;
using backend.Repository;
using backend.DTO;
using backend.Data;
using backend.Helpers;
using System;
using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace backend.Services
{
    public class OrderService
    {
        private readonly OrderRepository _orderRepo;
        private readonly ActivityLogService _logService;
        private readonly UserRepository _userRepo;
        private readonly CustomerRepository _customerRepo;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly AppDbContext _context;
        private readonly InvoiceService _invoiceService;
        private readonly PosCheckoutService _checkout;

        public OrderService(
            OrderRepository orderRepo,
            ActivityLogService logService,
            UserRepository userRepo,
            CustomerRepository customerRepo,
            IHttpContextAccessor httpContextAccessor,
            AppDbContext context,
            InvoiceService invoiceService, PosCheckoutService checkout)
        {
            _orderRepo = orderRepo;
            _logService = logService;
            _customerRepo = customerRepo;
            _userRepo = userRepo;
            _httpContextAccessor = httpContextAccessor;
            _context = context;
            _invoiceService = invoiceService;
            _checkout = checkout;
        }

        // Tự động lấy user_id
        private int GetCurrentUserId()
        {
            var context = _httpContextAccessor.HttpContext;

            // check claim JWT
            if (context?.User?.Identity?.IsAuthenticated == true)
            {
                var claim = context.User.FindFirst("uid")
                            ?? context.User.FindFirst("userId")
                            ?? context.User.FindFirst(ClaimTypes.NameIdentifier);

                if (claim != null && int.TryParse(claim.Value, out int id))
                    return id;
            }

            throw new InvalidOperationException("Không tìm thấy user_id trong token");
        }



        /*
            Phương thúc Tạo đơn hàng mới 
            Trả về object OrderDTO vừa tạo có 
                Id: Lấy max Id + 1
                OrderNumber: DH_Id_timestamp <Ví dụ: DH_5_1696543200>
                CustomerId: 0 => Mặc định là khách vãng lai
                UserId: Nhân viên đang tạo đơn hàng (Tạm thời để là 2 vì chưa biết ai đang làm đăng nhập . Tạm thời để đó)
                Status: pending
                Subtotal, Discount, TotalAmount: 0m
                PromotionId: null
                Note: null
                CreatedAt, UpdatedAt: thời gian hiện tại

        */
         public async Task<OrderDTO> CreateTemporaryOrderAsync()
        {
            
            string orderCode = Guid.NewGuid().ToString();

            // Lấy user_id thực tế
            int userId = GetCurrentUserId();
            var user = await _userRepo.GetByIdAsync(userId);
            string userName = user?.FullName ?? $"Nhân viên #{userId}";

           

            var tempOrder = new OrderDTO
            {
            
                OrderNumber = orderCode,
                CustomerId = null,
                UserId = userId,
                Status = "pending",
                Subtotal = 0m,
                Discount = 0m,
                TotalAmount = 0m,
                PromotionId = null,
                Note = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CustomerName = null,
                UserName = userName,
                PromotionCode = null
            };

            return tempOrder;
        }







        // Chuyển Order sang OrderDTO đầy đủ
        public async Task<OrderDTO> MapToDTOAsync(int orderId)
        {
            var order = await _context.Orders.Include(o => o.Customer).Include(o => o.User).Include(o => o.Promotion)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null) throw new Exception("Không tìm thấy đơn hàng");

            var delivery = OrderDeliveryDetails.FromOrder(order);

            return new OrderDTO
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                CustomerId = order.CustomerId ?? 0,
                UserId = order.UserId,
                Status = order.Status,
                OrderType = order.OrderType,
                PaymentStatus = order.PaymentStatus,
                PaymentMethod = order.PaymentMethod,
                IsPosCheckout = order.CheckoutKey != null,
                Subtotal = order.Subtotal,
                Discount = order.Discount,
                TotalAmount = order.TotalAmount,
                PromotionId = order.PromotionId,
                Note = delivery.Note,
                RecipientName = delivery.Name,
                RecipientPhone = delivery.Phone,
                ShippingAddress = delivery.Address,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
                CustomerName = order.Customer?.FullName,
                UserName = order.User?.FullName,
                PromotionCode = order.Promotion?.Code
            };
        }

        //Phân trang kết hợp tìm kiếm
        public async Task<PagedResult<OrderDTO>> GetPagedOrdersAsync(
            int pageNumber,
            int pageSize,
            string? status,
            DateTime? startDate,
            DateTime? endDate,
            string? search,
            string? orderType = null
        )
        {
            var (data, totalItems) = await _orderRepo.SearchPagingAsync(
                pageNumber, pageSize, status, startDate, endDate, search, orderType
            );

            return new PagedResult<OrderDTO>
            {
                Items = data,
                TotalItems = totalItems,
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
            };
        }
        public async Task<bool> CancelOrderAsync(int orderId)
        {
            if (await _context.Orders.AsNoTracking().AnyAsync(o => o.Id == orderId && o.OrderType == "pos"))
                return await _checkout.CancelAsync(orderId);
            // 1. Lấy user hiện tại
            int currentUserId = GetCurrentUserId();

            // 2. Kiểm tra order tồn tại
            var order = await _orderRepo.GetByIdAsync(orderId);
            if (order == null)
                return false;

            // 3. Ghi lại ai là người hủy đơn
            await _orderRepo.UpdateOrderUserAsync(orderId, currentUserId);

            // 4. Tiến hành hủy đơn
            var cancelled = await _orderRepo.CancelOrderAsync(orderId);
            if (cancelled) await _invoiceService.SyncOrderLifecycleAsync(orderId);
            return cancelled;
        }

        public async Task<bool> CompletePendingOrderAsync(int orderId)
        {
            var order = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
            if (order?.CheckoutKey != null)
                throw new InvalidOperationException("Đơn POS phải được xác nhận thanh toán theo đúng phương thức.");
            if (order?.PaymentStatus != "paid") throw new InvalidOperationException("Chưa có xác nhận thu đủ tiền cho đơn hàng.");
            var currentUserId = GetCurrentUserId();
            var completed = await _orderRepo.CompletePendingOrderAsync(orderId, currentUserId);
            if (completed) await _invoiceService.SyncOrderLifecycleAsync(orderId);
            return completed;
        }

        // ===== ONLINE ORDER MANAGEMENT =====

        public async Task<PagedResult<OnlineOrderDTO>> GetOnlineOrdersAsync(
            int pageNumber, int pageSize, string? status, string? search, int? orderId = null)
        {
            var query = _context.Orders
                .Include(o => o.Customer)
                .Include(o => o.Promotion)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .Where(o => o.OrderType == "mobile")
                .AsQueryable();

            if (orderId.HasValue) query = query.Where(o => o.Id == orderId.Value);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(o =>
                    (o.Customer != null && o.Customer.FullName.Contains(s)) ||
                    o.OrderNumber.Contains(s) ||
                    (o.Customer != null && o.Customer.Phone != null && o.Customer.Phone.Contains(s))
                );
            }

            var totalItems = await query.CountAsync();

            var orders = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var dtos = orders.Select(o =>
            {
                var delivery = OrderDeliveryDetails.FromOrder(o);
                return new OnlineOrderDTO
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    CustomerId = o.CustomerId,
                    CustomerName = delivery.Name ?? o.Customer?.FullName,
                    CustomerPhone = delivery.Phone ?? o.Customer?.Phone,
                    CustomerAddress = delivery.Address ?? o.Customer?.Address,
                    RecipientName = delivery.Name,
                    RecipientPhone = delivery.Phone,
                    ShippingAddress = delivery.Address,
                    Status = o.Status,
                    OrderType = o.OrderType,
                    Subtotal = o.Subtotal,
                    Discount = o.Discount,
                    TotalAmount = o.TotalAmount,
                    PaymentMethod = o.PaymentMethod,
                    PaymentStatus = o.PaymentStatus,
                    Note = delivery.Note,
                    PromotionCode = o.Promotion?.Code,
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt,
                    Items = o.OrderItems.Select(oi => new OnlineOrderItemDTO
                    {
                        Id = oi.Id,
                        ProductId = oi.ProductId,
                        ProductName = oi.Product?.ProductName ?? "",
                        Sku = oi.Product?.Sku,
                        ImageUrl = oi.Product?.ImageUrl,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice,
                        TotalPrice = oi.TotalPrice
                    }).ToList()
                };
            }).ToList();

            return new PagedResult<OnlineOrderDTO>
            {
                Items = dtos,
                TotalItems = totalItems,
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
            };
        }

        /// <summary>Xác nhận đơn: pending -> processing</summary>
        public async Task<bool> ConfirmOnlineOrderAsync(int orderId)
        {
            int userId = GetCurrentUserId();
            var now = DateTime.UtcNow;
            var updated = await _context.Orders
                .Where(o => o.Id == orderId && o.Status == "pending" && o.OrderType == "mobile" && o.CheckoutKey == null)
                .ExecuteUpdateAsync(u => u
                    .SetProperty(o => o.Status, "processing")
                    .SetProperty(o => o.UserId, (int?)userId)
                    .SetProperty(o => o.UpdatedAt, now));
            if (updated == 1) await _invoiceService.SyncOrderLifecycleAsync(orderId);
            return updated == 1;
        }

        /// <summary>Từ chối đơn: pending|processing -> cancelled (hoàn kho)</summary>
        public async Task<bool> RejectOnlineOrderAsync(int orderId, string? reason)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null) return false;
            if (order.OrderType != "mobile" || order.CheckoutKey != null) return false;
            if (order.Status != "pending" && order.Status != "processing") return false;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                order.Status = "cancelled";
                order.Note = string.IsNullOrWhiteSpace(reason)
                    ? order.Note
                    : (string.IsNullOrWhiteSpace(order.Note) ? $"Từ chối: {reason}" : $"{order.Note} | Từ chối: {reason}");
                order.UpdatedAt = now;

                // Hoàn lại kho
                var productIds = order.OrderItems.Select(i => i.ProductId).Distinct().ToList();
                var inventories = await _context.Inventory
                    .Where(i => productIds.Contains(i.ProductId))
                    .ToListAsync();

                foreach (var item in order.OrderItems)
                {
                    var inv = inventories.FirstOrDefault(i => i.ProductId == item.ProductId);
                    if (inv != null)
                    {
                        inv.Quantity += item.Quantity;
                        inv.UpdatedAt = now;
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                await _invoiceService.SyncOrderLifecycleAsync(orderId);
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        /// <summary>Giao hàng thành công: processing -> completed</summary>
        public async Task<bool> DeliverOnlineOrderAsync(int orderId)
        {
            int userId = GetCurrentUserId();
            var now = DateTime.UtcNow;
            var order = await _context.Orders
                .Include(o => o.Customer)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.Status == "processing" && o.OrderType == "mobile" && o.CheckoutKey == null);

            if (order == null) return false;

            if (order.PaymentMethod != "cash" && order.PaymentStatus != "paid")
                throw new InvalidOperationException("Chờ xác nhận thanh toán trước khi hoàn tất giao hàng.");
            order.Status = "completed";
            order.PaymentStatus = "paid";
            order.UserId = userId;
            order.UpdatedAt = now;

            // Tích điểm thưởng cho khách hàng nếu có tài khoản: 10.000đ = 1 điểm
            if (order.CustomerId.HasValue)
            {
                var pointsEarned = (int)(order.TotalAmount / 10000m);
                if (pointsEarned > 0)
                {
                    var customer = await _context.Customers.FindAsync(order.CustomerId.Value);
                    if (customer != null)
                    {
                        customer.RewardPoints += pointsEarned;
                        customer.UpdatedAt = now;
                    }
                }
            }

            await _context.SaveChangesAsync();
            await _invoiceService.SyncOrderLifecycleAsync(orderId);
            return true;
        }

        public async Task<bool> MarkOrderRefundedAsync(int orderId)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null || order.PaymentStatus != "paid" || order.Status == "cancelled") return false;
            await _invoiceService.EnsureInvoiceForOrderAsync(orderId);
            order.Status = "refunded";
            order.PaymentStatus = "refunded";
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _invoiceService.SyncOrderLifecycleAsync(orderId);
            return true;
        }

        /// <summary>Lấy danh sách items của đơn hàng</summary>
        public async Task<List<OnlineOrderItemDTO>> GetOrderItemsAsync(int orderId)
        {
            return await _context.OrderItems
                .Include(oi => oi.Product)
                .Where(oi => oi.OrderId == orderId)
                .Select(oi => new OnlineOrderItemDTO
                {
                    Id = oi.Id,
                    ProductId = oi.ProductId,
                    ProductName = oi.Product != null ? oi.Product.ProductName : "",
                    Sku = oi.Product != null ? oi.Product.Sku : null,
                    ImageUrl = oi.Product != null ? oi.Product.ImageUrl : null,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    TotalPrice = oi.TotalPrice
                })
                .ToListAsync();
        }
    }  // end class OrderService

    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalItems { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

}
