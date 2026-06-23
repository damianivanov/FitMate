using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Exercises;

public class ImageUploadTicketRequest
{
    [Required]
    [StringLength(260)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string ContentType { get; set; } = string.Empty;
}
