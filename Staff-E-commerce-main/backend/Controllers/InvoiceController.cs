using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class InvoiceController : ControllerBase
{
    private readonly InvoiceService _service;
    public InvoiceController(InvoiceService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] string? paymentStatus = null,
        [FromQuery] string? customerSearch = null)
        => Ok(await _service.GetInvoicesAsync(page, pageSize, from, to, paymentStatus, customerSearch));

    [HttpGet("{orderId:int}")]
    public async Task<IActionResult> Detail(int orderId)
    {
        var invoice = await _service.GetInvoiceAsync(orderId);
        return invoice == null ? NotFound() : Ok(invoice);
    }

}
