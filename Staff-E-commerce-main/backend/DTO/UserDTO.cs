using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace backend.DTO
{
    public class UserDTO
    {
        public int Id { get; set; }
        public int? EmployeeId { get; set; }
        public int? CustomerId { get; set; }
        public string? EmployeeName { get; set; }
        public string? CustomerName { get; set; }

        [Required]
        [MinLength(3)]
        [MaxLength(150)]
        public string Username { get; set; } = string.Empty;

        [EmailAddress]
        [RegularExpression(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", ErrorMessage = "Email is invalid.")]
        [MaxLength(255)]
        public string? Email { get; set; }

        [MaxLength(255)]
        public string? FullName { get; set; }

        [Required]
        [RegularExpression("^[a-zA-Z0-9_-]+$", ErrorMessage = "Role contains invalid characters.")]
        public string Role { get; set; } = "staff";

        public bool IsActive { get; set; }
        public bool IsLocked { get; set; }

        [MinLength(6)]
        [MaxLength(128)]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Password { get; set; }

        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastLogin { get; set; }
    }
}
