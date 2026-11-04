using System.Security.Claims;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Security;

/// <summary>
/// Describes the signed-in actor so services can stop users from granting more access than they hold.
/// </summary>
public sealed class ActorPermissionService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
{
    private HashSet<string>? _codes;
    private int? _roleId;

    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public bool IsAdmin => string.Equals(User?.FindFirst(ClaimTypes.Role)?.Value, "admin", StringComparison.OrdinalIgnoreCase);

    public int? UserId => int.TryParse(User?.FindFirst("uid")?.Value, out var id) ? id : null;

    public async Task<IReadOnlySet<string>> GetPermissionCodesAsync()
    {
        if (_codes != null) return _codes;
        var userId = UserId;
        if (userId == null) return _codes = new HashSet<string>();
        var access = await db.Users.AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new { user.RoleId, Codes = user.RoleEntity.RolePermissions.Select(link => link.Permission.Code).ToList() })
            .SingleOrDefaultAsync();
        _roleId = access?.RoleId;
        return _codes = new HashSet<string>(access?.Codes ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
    }

    public async Task<int?> GetRoleIdAsync()
    {
        await GetPermissionCodesAsync();
        return _roleId;
    }

    public Task<List<string>> GetRolePermissionCodesAsync(int roleId) => db.RolePermissions.AsNoTracking()
        .Where(link => link.RoleId == roleId)
        .Select(link => link.Permission.Code)
        .ToListAsync();

    /// <summary>
    /// Returns an error when a non-admin tries to grant permissions they do not hold
    /// or any account-administration permission. Admins may grant anything.
    /// </summary>
    public async Task<string?> GrantIssueAsync(IEnumerable<string> grantedCodes)
    {
        if (IsAdmin) return null;
        var held = await GetPermissionCodesAsync();
        var codes = grantedCodes.ToList();
        if (codes.Any(code => PermissionCatalog.AdministrationPermissions.Contains(code, StringComparer.OrdinalIgnoreCase)))
            return "Chỉ quản trị viên được cấp quyền quản lý tài khoản và phân quyền.";
        var missing = codes.Where(code => !held.Contains(code)).ToList();
        return missing.Count == 0 ? null : $"Bạn không thể cấp quyền mà chính bạn không có: {string.Join(", ", missing)}.";
    }
}
