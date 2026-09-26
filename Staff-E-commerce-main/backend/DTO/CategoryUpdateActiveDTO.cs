using System.ComponentModel.DataAnnotations;

namespace backend.DTO
{
    public class CategoryUpdateActiveDTO
    {
        [Required(ErrorMessage = "IsActive is required")]
        public bool IsActive { get; set; }
    }
}

