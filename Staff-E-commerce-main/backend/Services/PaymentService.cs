using backend.DTO;
using backend.Models;
using backend.Repository;
using Newtonsoft.Json;
using System.Security.Cryptography;
using System.Text;

namespace backend.Services
{
    public class PaymentService
    {
        private readonly PaymentRepository _paymentRepo;
        private readonly OrderRepository _orderRepo;
        private readonly ActivityLogService _logService;
        private readonly IConfiguration _config;
        private readonly InvoiceService _invoiceService;
        private readonly PosCheckoutService _checkout;
        private readonly RealtimeNotificationService _realtime;
        private readonly VoucherWalletService _vouchers;
        private readonly PaymentSimulator _simulator;

        public PaymentService(PaymentRepository paymentRepo, OrderRepository orderRepo, ActivityLogService logService,
            IConfiguration config, InvoiceService invoiceService, PosCheckoutService checkout,
            RealtimeNotificationService realtime, VoucherWalletService vouchers, PaymentSimulator simulator)
        {
            _simulator = simulator;
            _paymentRepo = paymentRepo;
            _orderRepo = orderRepo;
            _logService = logService;
            _config = config;
            _invoiceService = invoiceService;
            _checkout = checkout;
            _realtime = realtime;
            _vouchers = vouchers;
        }

        private static string SignSHA256(string message, string key) => PaymentSimulator.Sign(message, key);

        public async Task<MomoPaymentResponseDTO> CreatePaymentAsync(MomoPaymentRequestDTO req)
        {
            var order = await _paymentRepo.GetOrderSnapshotAsync(req.OrderId)
                ?? throw new ArgumentException("Không tìm thấy đơn hàng.");
            if (order.PaymentStatus != "pending" || order.Status is "cancelled" or "refunded" || order.PaymentMethod != "e_wallet")
                throw new ArgumentException("Đơn không còn chờ thanh toán MoMo.");
            req.Amount = order.TotalAmount;
            if (req.Amount != decimal.Truncate(req.Amount))
                throw new ArgumentException("Thanh toán MoMo yêu cầu số tiền nguyên đồng. Vui lòng kiểm tra giá sản phẩm.");
            string endpoint = _config["Momo:Endpoint"] ?? "";
            string partnerCode = _simulator.PartnerCode;
            string accessKey = _simulator.AccessKey;
            string secretKey = _simulator.SecretKey;
            string redirectUrl = req.ReturnUrl;
            string ipnUrl = req.NotifyUrl;


            // MoMo yêu cầu orderId và requestId dạng string
            string orderId = $"order_{req.OrderId}_{Guid.NewGuid():N}";
            string requestId = "req_" + Guid.NewGuid().ToString("N");

            if (_simulator.Enabled)
            {
                // Coursework mode: record the attempt and hand back the local simulator page instead of calling MoMo.
                await _paymentRepo.AddPaymentAsync(new Payment { OrderId = req.OrderId, Amount = req.Amount, Method = "other", TransactionRef = orderId, Status = "pending", CreatedAt = DateTime.UtcNow });
                return new MomoPaymentResponseDTO
                {
                    PayUrl = _simulator.MomoPageUrl(orderId),
                    OrderId = orderId,
                    RequestId = requestId,
                    Success = true,
                    Message = "Thanh toán MoMo giả lập"
                };
            }
            string orderInfo = $"Thanh toán đơn hàng {req.OrderId}";
            string amountStr = Math.Round(req.Amount).ToString("0");

            // Tạo signature chuẩn MoMo
            string requestType = "captureWallet"; // dùng chuẩn sandbox

            string rawSignature =
                $"accessKey={accessKey}" +
                $"&amount={amountStr}" +
                $"&extraData=" +
                $"&ipnUrl={ipnUrl}" +
                $"&orderId={orderId}" +
                $"&orderInfo={orderInfo}" +
                $"&partnerCode={partnerCode}" +
                $"&redirectUrl={redirectUrl}" +
                $"&requestId={requestId}" +
                $"&requestType={requestType}";

            string signature = SignSHA256(rawSignature, secretKey);

            var body = new
            {
                partnerCode,
                accessKey,
                requestId,
                amount = amountStr,
                orderId,
                orderInfo,
                redirectUrl,
                ipnUrl,
                extraData = "",
                requestType = requestType,
                signature
            };

            // Persist the attempt before contacting MoMo so a delayed callback can still be matched.
            var payment = new Payment { OrderId = req.OrderId, Amount = req.Amount, Method = "other", TransactionRef = orderId, Status = "pending", CreatedAt = DateTime.UtcNow };
            await _paymentRepo.AddPaymentAsync(payment);
            using var client = new HttpClient();
            var resp = await client.PostAsync(endpoint, new StringContent(JsonConvert.SerializeObject(body), Encoding.UTF8, "application/json"));
            var content = await resp.Content.ReadAsStringAsync();
            Console.WriteLine("MoMo Response: " + content);

            dynamic json = JsonConvert.DeserializeObject(content);
            string payUrl = json?.payUrl ?? "";
            bool success = !string.IsNullOrEmpty(payUrl);

            // Lưu payment vào DB
            // A callback may already have completed this attempt; never overwrite its status.
            if (!success)
                await _paymentRepo.MarkPendingPaymentFailedAsync(payment.Id);

            

            return new MomoPaymentResponseDTO
            {
                PayUrl = payUrl,
                OrderId = orderId,
                RequestId = requestId,
                Success = success,
                Message = json?.message
            };
        }

        public async Task<bool> HandleMomoCallbackAsync(MomoIpnCallbackDTO callback)
        {
            var accessKey = _simulator.AccessKey;
            var secretKey = _simulator.SecretKey;
            if (string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey) ||
                string.IsNullOrWhiteSpace(callback.OrderId) || callback.Amount is not long receivedAmount)
                return false;

            // Signature kiểm tra callback
            string rawSignature = PaymentSimulator.MomoCallbackRawSignature(accessKey, callback);

            var expected = SignSHA256(rawSignature, secretKey);
            if (string.IsNullOrWhiteSpace(callback.Signature)) return false;
            var actualBytes = Encoding.UTF8.GetBytes(callback.Signature.ToLowerInvariant());
            var expectedBytes = Encoding.UTF8.GetBytes(expected);
            if (actualBytes.Length != expectedBytes.Length ||
                !CryptographicOperations.FixedTimeEquals(actualBytes, expectedBytes)) return false;
            if (!string.IsNullOrWhiteSpace(_simulator.PartnerCode) &&
                !string.Equals(callback.PartnerCode, _simulator.PartnerCode, StringComparison.Ordinal)) return false;

            var snapshot = await _paymentRepo.GetByTransactionRefAsync(callback.OrderId);
            if (snapshot == null || snapshot.Amount != receivedAmount) return false;
            var orderSnapshot = await _paymentRepo.GetOrderSnapshotAsync(snapshot.OrderId);
            if (orderSnapshot == null || orderSnapshot.TotalAmount != receivedAmount) return false;

            if (orderSnapshot.OrderType == "pos" && callback.ResultCode == 0)
            {
                try
                {
                    await _checkout.ConfirmAsync(orderSnapshot.Id, receivedAmount, callback.OrderId, momo: true);
                    await _realtime.BroadcastToWeb("OrderStatusChanged", new { orderId = orderSnapshot.Id, paymentStatus = "paid" });
                    return true;
                }
                catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
                {
                    return false;
                }
            }

            await using var transaction = await _paymentRepo.BeginSerializableTransactionAsync();
            await _vouchers.LockAsync();
            await _paymentRepo.LockTransactionAsync(callback.OrderId);
            var payment = await _paymentRepo.GetForCallbackAsync(callback.OrderId);
            if (payment?.Order == null || payment.Amount != receivedAmount || payment.Order.TotalAmount != receivedAmount)
                return false;
            if (callback.ResultCode != 0)
            {
                if (payment.Status == "pending") payment.Status = "failed";
                await _paymentRepo.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            if (payment.Status == "completed" && payment.Order.PaymentStatus == "paid")
            {
                await transaction.CommitAsync();
                return true;
            }
            if (payment.Status == "refund_required")
            {
                await transaction.CommitAsync();
                return true;
            }
            if (payment.Status == "pending" &&
                (payment.Order.Status is "cancelled" or "refunded" || payment.Order.PaymentStatus != "pending"))
            {
                // Money arrived for an order that can no longer take it (cancelled, or already paid by another
                // attempt). Keep a reconciliation trail and acknowledge, so MoMo stops retrying the IPN.
                payment.Status = "refund_required";
                await _paymentRepo.SaveChangesAsync();
                await transaction.CommitAsync();
                await _logService.LogAsync(payment.Order.UserId, "PAYMENT_REFUND_REQUIRED", "Payment", payment.Id.ToString(),
                    $"Đơn {payment.Order.OrderNumber}: nhận {receivedAmount:0} qua MoMo ({callback.OrderId}) nhưng đơn không còn chờ thanh toán. Cần hoàn tiền cho khách.", "system");
                await _realtime.BroadcastToWeb("PaymentRefundRequired", new { orderId = payment.Order.Id, amount = receivedAmount }, "payments.read");
                return true;
            }
            if (payment.Status != "pending" || payment.Order.PaymentStatus != "pending") return false;

            payment.Status = "completed";
            payment.Order.PaymentStatus = "paid";
            if (payment.Order.Status == "pending") payment.Order.Status = "processing";
            payment.Order.UpdatedAt = DateTime.UtcNow;
            await _paymentRepo.SaveChangesAsync();
            await _invoiceService.SyncOrderLifecycleAsync(payment.Order.Id);
            await transaction.CommitAsync();

            await _logService.LogAsync(payment.Order.UserId, "PAYMENT_SUCCESS", "Payment", payment.Id.ToString(), null, "system");
            await _logService.LogAsync(null, "payment_received", "orders", payment.Order.Id.ToString(), $"MoMo {callback.OrderId}", "system");
            await _realtime.BroadcastToWeb("OrderStatusChanged", new
            {
                orderId = payment.Order.Id,
                status = payment.Order.Status,
                paymentStatus = "paid"
            });
            return true;
        }

        public async Task<PaymentResponseDTO?> GetByOrderIdAsync(int orderId)
        {
            var payment = await _paymentRepo.GetByOrderIdAsyncVer2(orderId);

            if (payment == null)
                return null;

            return new PaymentResponseDTO(
                method: payment.Method,
                transaction_ref: payment.TransactionRef,
                status: payment.Status
            );
        }

    

    }
}








