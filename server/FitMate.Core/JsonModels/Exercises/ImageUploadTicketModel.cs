namespace FitMate.Core.JsonModels.Exercises;

public class ImageUploadTicketModel
{
    /// <summary>Short-lived SAS URL the browser PUTs the image bytes directly to.</summary>
    public string UploadUrl { get; set; } = string.Empty;

    /// <summary>Opaque staging blob path echoed back to the confirm endpoint to finalize the upload.</summary>
    public string BlobName { get; set; } = string.Empty;
}
