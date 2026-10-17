using backend.DTO;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InvoiceController : ControllerBase
{
    private readonly InvoiceService _service;
    public InvoiceController(InvoiceService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] string? paymentStatus = null)
        => Ok(await _service.GetInvoicesAsync(page, pageSize, from, to, paymentStatus));

    [HttpGet("{orderId:int}")]
    public async Task<IActionResult> Detail(int orderId)
    {
        var invoice = await _service.GetInvoiceAsync(orderId);
        return invoice == null ? NotFound() : Ok(invoice);
    }

    [HttpPatch("{orderId:int}/payment-status")]
    public async Task<IActionResult> UpdatePaymentStatus(int orderId, [FromBody] UpdateInvoicePaymentStatusDTO body)
    {
        try { return await _service.UpdatePaymentStatusAsync(orderId, body.Status) ? NoContent() : NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
