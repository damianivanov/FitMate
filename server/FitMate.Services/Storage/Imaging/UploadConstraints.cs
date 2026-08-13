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

    public const string UnsupportedTypeMessage = "Unsupported file type. Upload a JPEG, PNG, WebP, or GIF image.";

    public static bool IsAllowed(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && AllowedContentTypes.Contains(contentType.Trim());

    public static string ExtensionFor(string contentType) => contentType.Trim().ToLowerInvariant() switch
    {
        "image/jpeg" or "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "img",
    };
}
