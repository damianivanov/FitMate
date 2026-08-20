using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Exercises;

public class ConfirmBulkExerciseImageRequest
{
    [Required]
    [StringLength(200)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    [StringLength(512)]
    public string BlobName { get; set; } = string.Empty;
}
