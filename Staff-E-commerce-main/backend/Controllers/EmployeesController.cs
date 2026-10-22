using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EmployeesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public EmployeesController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeDTO>>> GetAll()
        {
            return Ok(await _db.Employees.AsNoTracking().Include(e => e.Account).OrderBy(e => e.FullName)
                .Select(e => ToDto(e)).ToListAsync());
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<EmployeeDTO>> Get(int id)
        {
            var employee = await _db.Employees.AsNoTracking().Include(e => e.Account).FirstOrDefaultAsync(e => e.Id == id);
            return employee == null ? NotFound() : Ok(ToDto(employee));
        }

        [HttpPost]
        public async Task<ActionResult<EmployeeDTO>> Create(EmployeeDTO request)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);
            var employee = new Employee
            {
                FullName = request.FullName.Trim(),
                Phone = request.Phone?.Trim(),
                Email = request.Email?.Trim(),
                DateOfBirth = request.DateOfBirth,
                Address = request.Address?.Trim(),
                Note = request.Note?.Trim(),
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = employee.Id }, ToDto(employee));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<EmployeeDTO>> Update(int id, EmployeeDTO request)
        {
            var employee = await _db.Employees.Include(e => e.Account).FirstOrDefaultAsync(e => e.Id == id);
            if (employee == null) return NotFound();
            if (!ModelState.IsValid) return ValidationProblem(ModelState);
            employee.FullName = request.FullName.Trim();
            employee.Phone = request.Phone?.Trim();
            employee.Email = request.Email?.Trim();
            employee.DateOfBirth = request.DateOfBirth;
            employee.Address = request.Address?.Trim();
            employee.Note = request.Note?.Trim();
            employee.IsActive = request.IsActive;
            employee.UpdatedAt = DateTime.UtcNow;
            if (employee.Account != null)
            {
                if (!string.IsNullOrWhiteSpace(employee.Email) && await _db.Users.AnyAsync(u => u.Id != employee.Account.Id && u.Email == employee.Email))
                    return Conflict(new { message = "Email đã được tài khoản khác sử dụng." });
                employee.Account.FullName = employee.FullName;
                employee.Account.Email = employee.Email;
                employee.Account.UpdatedAt = employee.UpdatedAt;
                if (!employee.IsActive)
                {
                    employee.Account.IsActive = false;
                    employee.Account.IsLocked = true;
                    employee.Account.SessionVersion++;
                }
            }
            await _db.SaveChangesAsync();
            return Ok(ToDto(employee));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var employee = await _db.Employees.FindAsync(id);
            if (employee == null) return NotFound();
            if (await _db.Users.AnyAsync(u => u.EmployeeId == id))
                return Conflict("Không thể xóa hồ sơ đang được cấp tài khoản.");
            _db.Employees.Remove(employee);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static EmployeeDTO ToDto(Employee e) => new()
        {
            Id = e.Id, FullName = e.FullName, Phone = e.Phone, Email = e.Email,
            Address = e.Address, Note = e.Note, IsActive = e.IsActive, DateOfBirth = e.DateOfBirth,
            HasAccount = e.Account != null,
            AccountUsername = e.Account?.Username
        };
    }
}
