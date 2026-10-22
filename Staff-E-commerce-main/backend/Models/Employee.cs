using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace backend.Models
{
    [Table("employees")]
    [Index(nameof(Email), IsUnique = true, Name = "ux_employees_email")]
    public class Employee
    {
        [Key]
        public int Id { get; set; }

        [Required, StringLength(255)]
        [Column("full_name")]
        public string FullName { get; set; } = string.Empty;

        [StringLength(50)]
        public string? Phone { get; set; }

        [StringLength(255)]
        public string? Email { get; set; }
        [Column("date_of_birth")]
        public DateTime? DateOfBirth { get; set; }

        public string? Address { get; set; }
        public string? Note { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; }

        public virtual User? Account { get; set; }
    }
}
