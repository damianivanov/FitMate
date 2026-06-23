using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Exercises;

public class ConfirmImageUploadRequest
{
    [Required]
    [StringLength(512)]
    public string BlobName { get; set; } = string.Empty;
}
