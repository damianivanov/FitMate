using System.Text.RegularExpressions;

namespace FitMate.Services.Storage.Blobs;

public static partial class BlobPathBuilder
{
    public static string Build(StorageModule module, long id, string fileName, string extension, DateTime utcNow)
    {
        var timestamp = utcNow.ToString("yyyyMMddTHHmmssfffZ");
        var name = Sanitize(Path.GetFileNameWithoutExtension(fileName ?? string.Empty));
        if (string.IsNullOrEmpty(name))
        {
            name = "image";
        }

        return $"{module.ToFolder()}/{id}/{timestamp}-{name}.{extension}";
    }

    public static string Sanitize(string fileName)
    {
        var stripped = Path.GetFileName(fileName ?? string.Empty).ToLowerInvariant();
        var cleaned = InvalidCharsRegex().Replace(stripped, "-").Trim('-');
        if (cleaned.Length > 60)
        {
            cleaned = cleaned[..60].Trim('-');
        }

        return cleaned;
    }    public static bool IsOwnedBlobPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim();
        if (trimmed.StartsWith('/'))
        {
            return false;
        }

        var isAbsoluteUrl = Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

        return !isAbsoluteUrl;
    }

    [GeneratedRegex("[^a-z0-9.-]+")]
    private static partial Regex InvalidCharsRegex();
}
