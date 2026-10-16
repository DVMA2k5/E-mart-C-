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
    [Authorize(Roles = "admin")]
    public class RolesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public RolesController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<RoleDTO>>> GetRoles()
        {
            var roles = await _db.Roles
                .AsNoTracking()
                .Include(r => r.RolePermissions)
                .OrderBy(r => r.Name)
                .Select(r => new RoleDTO
                {
                    Id = r.Id,
                    Name = r.Name,
                    Description = r.Description,
                    IsActive = r.IsActive,
                    PermissionIds = r.RolePermissions.Select(rp => rp.PermissionId).ToList(),
                    Permissions = r.RolePermissions.Select(rp => rp.Permission.Code).ToList()
                })
                .ToListAsync();

            return Ok(roles);
        }

        [HttpGet("permissions")]
        public async Task<ActionResult> GetPermissions()
        {
            return Ok(await _db.Permissions.AsNoTracking().OrderBy(p => p.Code).ToListAsync());
        }

        [HttpPost]
        public async Task<ActionResult<RoleDTO>> CreateRole(RoleDTO request)
        {
            request.Name = request.Name.Trim().ToLowerInvariant();
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            if (await _db.Roles.AnyAsync(r => r.Name == request.Name))
                return Conflict("Role already exists.");

            var role = new Role
            {
                Name = request.Name,
                Description = request.Description?.Trim(),
                IsActive = request.IsActive
            };

            var permissions = await _db.Permissions
                .Where(p => request.PermissionIds.Contains(p.Id))
                .ToListAsync();
            if (permissions.Count != request.PermissionIds.Distinct().Count())
                return BadRequest("One or more permissions do not exist.");

            role.RolePermissions = permissions
                .Select(p => new RolePermission { Permission = p })
                .ToList();

            _db.Roles.Add(role);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetRoles), new { id = role.Id }, ToDto(role));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<RoleDTO>> UpdateRole(int id, RoleDTO request)
        {
            var role = await _db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (role == null)
                return NotFound();

            request.Name = request.Name.Trim().ToLowerInvariant();
            if (!ModelState.IsValid)
                return ValidationProblem(ModelState);

            if (await _db.Roles.AnyAsync(r => r.Id != id && r.Name == request.Name))
                return Conflict("Role already exists.");

            var permissions = await _db.Permissions
                .Where(p => request.PermissionIds.Contains(p.Id))
                .ToListAsync();
            if (permissions.Count != request.PermissionIds.Distinct().Count())
                return BadRequest("One or more permissions do not exist.");

            role.Name = request.Name;
            role.Description = request.Description?.Trim();
            role.IsActive = request.IsActive;
            _db.RolePermissions.RemoveRange(role.RolePermissions);
            role.RolePermissions = permissions
                .Select(p => new RolePermission { RoleId = role.Id, PermissionId = p.Id })
                .ToList();

            await _db.SaveChangesAsync();
            return Ok(ToDto(role));
        }

        private static RoleDTO ToDto(Role role) => new()
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            IsActive = role.IsActive,
            PermissionIds = role.RolePermissions.Select(rp => rp.PermissionId).ToList()
        };
    }
}
