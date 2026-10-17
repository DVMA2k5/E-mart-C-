using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models
{
    [Table("role_permissions")]
    public class RolePermission
    {
        [Column("role_id")]
        public int RoleId { get; set; }

        [Column("permission_id")]
        public int PermissionId { get; set; }

        public virtual Role Role { get; set; } = null!;
        public virtual Permission Permission { get; set; } = null!;
    }
}
