using backend.Data;
using backend.DTO;
using backend.Models;
using backend.Services;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly JwtService _jwt;
        private readonly UserService _users;

        public AuthController(AppDbContext db, JwtService jwt, UserService users)
        {
            _db = db;
            _jwt = jwt;
            _users = users;
        }

        [HttpPost("register")]
        [Authorize]
        public async Task<IActionResult> Register([FromBody] UserDTO req)
        {
            var created = await _users.CreateUserAsync(req);
            return Created($"/api/users/{created!.Id}", created);
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {

            if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            {
                Console.WriteLine("❌ Username or password is empty");
                return BadRequest(new { message = "Vui lòng nhập tên đăng nhập và mật khẩu" });
            }

            var user = await _db.Users
                .Include(u => u.RoleEntity)
                .Include(u => u.Employee)
                .FirstOrDefaultAsync(u => u.Username == req.Username);

            if (user == null)
            {
                Console.WriteLine($"❌ User not found: {req.Username}");
                return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng" });
            }

            Console.WriteLine($"✅ User found - ID: {user.Id}, IsActive: {user.IsActive}");

            if (!user.IsActive || user.IsLocked || !user.RoleEntity.IsActive || user.Employee?.IsActive == false)
            {
                Console.WriteLine("❌ User is inactive");
                return Unauthorized(new { message = "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên" });
            }

            bool passwordValid = BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash);
            Console.WriteLine($"🔐 Password verification: {passwordValid}");

            if (!passwordValid)
            {
                Console.WriteLine("❌ Password incorrect");
                return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng" });
            }

            if (string.Equals(user.RoleEntity?.Name, "customer", StringComparison.OrdinalIgnoreCase))
                return StatusCode(403, new { message = "Tài khoản khách hàng chỉ đăng nhập trên ứng dụng khách hàng." });

            user.LastLogin = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            var (token, expiresIn) = _jwt.GenerateToken(user);
            Console.WriteLine($"✅ Token generated successfully");

            return Ok(new AuthResponse
            {
                Token = token,
                TokenType = "Bearer",
                ExpiresIn = expiresIn,
                UserId = user.Id,
                UserName = user.Username,
                Role = user.RoleEntity?.Name ?? string.Empty
            });
        }

        private const int BcryptWorkFactor = 11;
        private static string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: BcryptWorkFactor);
    }
}
