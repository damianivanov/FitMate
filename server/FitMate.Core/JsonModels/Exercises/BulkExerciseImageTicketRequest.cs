using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Exercises;

public class BulkExerciseImageTicketRequest
{
    /// <summary>The exercise slug the image file was named after, e.g. <c>barbell-squat.png</c>.</summary>
    [Required]
    [StringLength(200)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string ContentType { get; set; } = string.Empty;
}
