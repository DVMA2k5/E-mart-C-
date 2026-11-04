using backend.DTO;
using backend.Security;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserService _users;
        private readonly AuthService _auth;
        private readonly LoginThrottle _throttle;

        public AuthController(UserService users, AuthService auth, LoginThrottle throttle)
        {
            _users = users;
            _auth = auth;
            _throttle = throttle;
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
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var username = req.Username ?? "";
            if (_throttle.RetryAfter("staff", username, ip) is { } wait)
                return StatusCode(429, new { message = LoginThrottle.Message(wait) });

            var result = await _auth.LoginAsync(req);
            if (result.Response is not null)
            {
                _throttle.RegisterSuccess("staff", username);
                return Ok(result.Response);
            }
            if (result.StatusCode == 401) _throttle.RegisterFailure("staff", username, ip);
            return StatusCode(result.StatusCode, new { message = result.Error });
        }
    }
}
