using backend.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Security;

public static class SessionValidator
{
    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        if (!int.TryParse(principal?.FindFirst("uid")?.Value, out var id) ||
            !int.TryParse(principal.FindFirst("session_version")?.Value, out var version))
        {
            context.Fail("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
            return;
        }
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var roleName = principal.FindFirst(ClaimTypes.Role)?.Value;
        var valid = await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && u.SessionVersion == version &&
            u.IsActive && !u.IsLocked && u.RoleEntity.IsActive &&
            u.RoleEntity.Name == roleName &&
            (u.EmployeeId == null || u.Employee!.IsActive) &&
            (u.CustomerId == null || u.Customer!.IsActive));
        if (!valid) context.Fail("Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.");
    }
}
