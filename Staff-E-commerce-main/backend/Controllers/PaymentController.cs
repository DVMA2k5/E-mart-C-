using System.Net;
using backend.DTO;
using backend.Repository;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly PaymentService _paymentService;
        private readonly PaymentSimulator _simulator;
        private readonly PaymentRepository _payments;
        private readonly OrderService _orders;

        public PaymentController(PaymentService paymentService, PaymentSimulator simulator, PaymentRepository payments, OrderService orders)
        {
            _paymentService = paymentService;
            _simulator = simulator;
            _payments = payments;
            _orders = orders;
        }

        [HttpPost("momo/create")]
        public async Task<IActionResult> CreatePayment([FromBody] MomoPaymentRequestDTO req)
        {
            try
            {
                var result = await _paymentService.CreatePaymentAsync(req);
                if (!result.Success) return BadRequest(new { message = "Tạo payment MoMo thất bại" });
                return Ok(new { payUrl = result.PayUrl, orderId = req.OrderId });
            }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpGet("momo/return")]
        [AllowAnonymous]
        public IActionResult MomoReturn() => Page("Đã trở về từ MoMo",
            "<p>Quay lại màn hình đơn hàng để kiểm tra trạng thái thanh toán. Hệ thống sẽ cập nhật khi nhận được xác nhận từ MoMo.</p><p>Bạn có thể đóng tab này.</p>");

        [HttpPost("momo/ipn")]
        [AllowAnonymous]
        public async Task<IActionResult> MomoCallback([FromBody] MomoIpnCallbackDTO callback)
        {
            bool valid = await _paymentService.HandleMomoCallbackAsync(callback);
            if (!valid)
            {
                return BadRequest(new { message = "Invalid signature" });
            }

            return Ok(new { message = "Callback handled successfully" });
        }

        // Lấy 1 payment duy nhất theo orderId
        [HttpGet("getbyorder/{orderId}")]
        public async Task<IActionResult> GetPayment(int orderId)
        {
            var payment = await _paymentService.GetByOrderIdAsync(orderId);
            if (payment == null)
                return NotFound("Payment not found");

            return Ok(payment);
        }

        [HttpGet("status/{orderId}")]
        public async Task<IActionResult> GetPaymentStatus(int orderId)
        {
            var payment = await _paymentService.GetByOrderIdAsync(orderId);
            if (payment == null)
                return NotFound(new { message = "Payment not found" });

            return Ok(new {
                status = payment.status,
                method = payment.method,
                transaction_ref = payment.transaction_ref
            });
        }

        // ---------------- Payment simulator (coursework demo only) ----------------
        // The attempt reference / bank token in the URL is random, so only the person holding the payment link
        // can complete it. Both pages are disabled when Payments:Mode = "Live".

        [HttpGet("simulator/momo/{reference}")]
        [AllowAnonymous]
        public async Task<IActionResult> MomoSimulatorPage(string reference)
        {
            if (!_simulator.Enabled) return NotFound();
            var payment = await _payments.GetByTransactionRefAsync(reference);
            if (payment == null) return Page("Không tìm thấy giao dịch", "<p>Liên kết thanh toán không hợp lệ hoặc đã hết hạn.</p>", 404);
            var order = await _payments.GetOrderSnapshotAsync(payment.OrderId);
            var actionUrl = $"/api/payment/simulator/momo/{Uri.EscapeDataString(reference)}";
            var body = payment.Status != "pending"
                ? $"<p>Giao dịch này đã được xử lý (trạng thái: <b>{Html(payment.Status)}</b>).</p><p>Hãy quay lại ứng dụng để xem đơn hàng.</p>"
                : $"""
                   <p class="tag">MÔI TRƯỜNG GIẢ LẬP – không trừ tiền thật</p>
                   <p>Đơn hàng: <b>{Html(order?.OrderNumber ?? payment.OrderId.ToString())}</b></p>
                   <p class="amount">{payment.Amount:N0} đ</p>
                   <form method="post" action="{actionUrl}"><input type="hidden" name="result" value="success"><button class="ok">Thanh toán thành công</button></form>
                   <form method="post" action="{actionUrl}"><input type="hidden" name="result" value="fail"><button class="fail">Hủy / thanh toán thất bại</button></form>
                   """;
            return Page("Ví MoMo (giả lập)", body);
        }

        [HttpPost("simulator/momo/{reference}")]
        [AllowAnonymous]
        public async Task<IActionResult> CompleteMomoSimulation(string reference, [FromForm] string result)
        {
            if (!_simulator.Enabled) return NotFound();
            var payment = await _payments.GetByTransactionRefAsync(reference);
            if (payment == null) return Page("Không tìm thấy giao dịch", "<p>Liên kết thanh toán không hợp lệ.</p>", 404);
            var success = string.Equals(result, "success", StringComparison.OrdinalIgnoreCase);
            var callback = _simulator.BuildMomoCallback(reference, (long)payment.Amount, success);
            var handled = await _paymentService.HandleMomoCallbackAsync(callback);
            var after = await _payments.GetByTransactionRefAsync(reference);
            if (!handled)
                return Page("Không thể ghi nhận", "<p>Đơn hàng không còn chờ thanh toán (có thể đã bị hủy hoặc số tiền đã thay đổi).</p>", 409);
            return after?.Status switch
            {
                "completed" => Page("Thanh toán thành công", "<p class=\"okText\">MoMo (giả lập) đã xác nhận thanh toán.</p><p>Quay lại ứng dụng, đơn hàng sẽ hiển thị <b>Đã thanh toán</b>.</p>"),
                "refund_required" => Page("Cần hoàn tiền", "<p>Đơn không còn chờ thanh toán. Giao dịch được ghi nhận để cửa hàng hoàn tiền.</p>"),
                _ => Page("Thanh toán thất bại", "<p>Giao dịch đã bị hủy. Bạn có thể thanh toán lại từ lịch sử đơn hàng.</p>")
            };
        }

        [HttpGet("simulator/bank/{orderId:int}/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> BankSimulatorPage(int orderId, string token)
        {
            if (!_simulator.Enabled || !_simulator.IsValidBankToken(orderId, token)) return NotFound();
            var order = await _payments.GetOrderSnapshotAsync(orderId);
            if (order == null || order.PaymentMethod != "card") return Page("Không tìm thấy đơn", "<p>Liên kết chuyển khoản không hợp lệ.</p>", 404);
            if (order.PaymentStatus != "pending" || order.Status is "cancelled" or "refunded")
                return Page("Đơn đã xử lý", $"<p>Đơn <b>{Html(order.OrderNumber)}</b> không còn chờ chuyển khoản.</p>");
            var body = $"""
                <p class="tag">MÔI TRƯỜNG GIẢ LẬP – không chuyển tiền thật</p>
                <p>Chuyển khoản cho đơn <b>{Html(order.OrderNumber)}</b></p>
                <p class="amount">{order.TotalAmount:N0} đ</p>
                <p>Nội dung: <b>EMART_{Html(order.OrderNumber)}</b></p>
                <form method="post"><button class="ok">Xác nhận đã chuyển khoản</button></form>
                """;
            return Page("Ngân hàng (giả lập)", body);
        }

        [HttpPost("simulator/bank/{orderId:int}/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> CompleteBankSimulation(int orderId, string token)
        {
            if (!_simulator.Enabled || !_simulator.IsValidBankToken(orderId, token)) return NotFound();
            try
            {
                var ok = await _orders.ConfirmOnlineTransferAsync(orderId, $"SIM-BANK-{orderId}", actorUserId: null);
                return ok
                    ? Page("Chuyển khoản thành công", "<p class=\"okText\">Ngân hàng (giả lập) đã báo nhận tiền.</p><p>Quay lại ứng dụng, đơn hàng sẽ hiển thị <b>Đã thanh toán</b>.</p>")
                    : Page("Không tìm thấy đơn", "<p>Liên kết chuyển khoản không hợp lệ.</p>", 404);
            }
            catch (InvalidOperationException ex) { return Page("Không thể ghi nhận", $"<p>{Html(ex.Message)}</p>", 409); }
        }

        private static string Html(string? value) => WebUtility.HtmlEncode(value ?? "");

        private ContentResult Page(string title, string body, int status = 200) => new()
        {
            StatusCode = status,
            ContentType = "text/html; charset=utf-8",
            Content = $$"""
                <!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{{Html(title)}}</title>
                <style>
                  body{font-family:system-ui,sans-serif;background:#f6f7fb;margin:0;padding:24px;color:#1a202c}
                  main{max-width:420px;margin:40px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.08)}
                  h1{font-size:20px;margin:0 0 12px}.tag{display:inline-block;background:#fff4d6;color:#8a5a00;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600}
                  .amount{font-size:28px;font-weight:700;color:#a50064;margin:8px 0 16px}
                  button{width:100%;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
                  .ok{background:#a50064;color:#fff}.fail{background:#edf2f7;color:#1a202c}.okText{color:#047857;font-weight:600}
                </style></head><body><main><h1>{{Html(title)}}</h1>{{body}}</main></body></html>
                """
        };
    }
}
