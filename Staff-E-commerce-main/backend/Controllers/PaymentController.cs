using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using backend.Models;
using Microsoft.AspNetCore.Authorization;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly PaymentService _paymentService;
        private readonly ActivityLogService _logService;

        public PaymentController(PaymentService paymentService, ActivityLogService logService)
        {
            _paymentService = paymentService;
            _logService = logService;
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
        public IActionResult MomoReturn() => Content("""
            <!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Trở về từ MoMo</title><body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:24px">
            <h1>Đã trở về từ MoMo</h1><p>Quay lại màn hình đơn hàng để kiểm tra trạng thái thanh toán. Hệ thống sẽ cập nhật khi nhận được xác nhận từ MoMo.</p>
            <p>Bạn có thể đóng tab này.</p></body></html>
            """, "text/html; charset=utf-8");

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

        // POST: api/payment
        [HttpPost("offlinepayment")]
        public async Task<IActionResult> CreateOfflinePayment([FromBody] Payment payment)
        {
            try { return Ok(await _paymentService.CreatePaymentAsync(payment)); }
            catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
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



    }
}






