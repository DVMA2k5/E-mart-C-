using System.ComponentModel.DataAnnotations;

namespace backend.DTO
{
    public class RoleDTO
    {
        public int Id { get; set; }

        [Required, MinLength(2), MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;
        public List<int> PermissionIds { get; set; } = new();
        public List<string> Permissions { get; set; } = new();
    }
}
