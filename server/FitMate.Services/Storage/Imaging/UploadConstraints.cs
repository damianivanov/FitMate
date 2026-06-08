namespace FitMate.Services.Storage.Imaging;

public static class UploadConstraints
{
    public const long MaxBytes = 8 * 1024 * 1024;

    public static readonly IReadOnlySet<string> AllowedContentTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
    };
}
