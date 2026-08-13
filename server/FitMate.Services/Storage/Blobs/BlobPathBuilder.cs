using System.Text.RegularExpressions;

namespace FitMate.Services.Storage.Blobs;

public static partial class BlobPathBuilder
{
    /// <summary>
    /// Holds bytes the browser PUT directly to storage until the server has validated them. Nested
    /// under the owner's folder so the same <c>{module}/{id}/</c> prefix delete sweeps it away.
    /// </summary>
    public const string StagingFolder = "incoming";

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
    }

    public static string BuildStagingPath(StorageModule module, long id, string extension)
        => $"{StagingPrefix(module, id)}{Guid.NewGuid():N}.{extension}";

    public static string StagingPrefix(StorageModule module, long id)
        => $"{module.ToFolder()}/{id}/{StagingFolder}/";

    public static string OwnerPrefix(StorageModule module, long id)
        => $"{module.ToFolder()}/{id}/";

    /// <summary>
    /// Guards a client-supplied staging reference: it must sit under the caller's own staging prefix
    /// and must not traverse out of it, so a confirm can never finalize someone else's blob.
    /// </summary>
    public static bool IsOwnStagingPath(StorageModule module, long id, string? blobName)
    {
        var trimmed = blobName?.Trim() ?? string.Empty;

        return trimmed.StartsWith(StagingPrefix(module, id), StringComparison.Ordinal)
            && !trimmed.Contains("..", StringComparison.Ordinal);
    }

    public static bool IsOwnedBlobPath(string? value)
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

    /// <summary>
    /// Rebuilds the full owned blob path (<c>{module}/{id}/{name}</c>) from a stored bare file name.
    /// Values that are not bare owned names — external URLs, "/static" paths, or already-qualified
    /// blob paths (containing a '/') — are returned unchanged so old data keeps resolving.
    /// </summary>
    public static string? Compose(StorageModule module, long id, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        var trimmed = value.Trim();
        if (!IsOwnedBlobPath(trimmed) || trimmed.Contains('/'))
        {
            return trimmed;
        }

        return $"{module.ToFolder()}/{id}/{trimmed}";
    }

    [GeneratedRegex("[^a-z0-9.-]+")]
    private static partial Regex InvalidCharsRegex();
}
