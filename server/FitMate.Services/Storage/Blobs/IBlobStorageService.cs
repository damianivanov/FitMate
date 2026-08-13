namespace FitMate.Services.Storage.Blobs;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream content, string path, string contentType);

    Task DeleteByPrefixAsync(string prefix);

    Task DeleteAsync(string path);

    /// <summary>
    /// Issues a signed read URL. The signature is snapped to a fixed time grid, so repeated calls
    /// within the same window return a byte-identical URL and the browser (and the service worker's
    /// image cache, which keys on the whole URL) can actually reuse what it already downloaded.
    /// Pass <paramref name="lifetime"/> to widen that window for content worth caching longer.
    /// </summary>
    Task<string> GetReadUrlAsync(string path, TimeSpan? lifetime = null);

    /// <summary>
    /// Issues a short-lived SAS URL the browser can PUT a single blob to directly, bypassing the
    /// app server entirely. Used so large image bytes never traverse the ingress (which resets
    /// streaming multipart POSTs when the container is scaled to zero / on the serverless runtime).
    /// </summary>
    Task<string> GetWriteUrlAsync(string path, string contentType);

    /// <summary>
    /// Downloads a blob into a seekable in-memory stream, or returns <c>null</c> if it does not exist.
    /// </summary>
    Task<Stream?> DownloadAsync(string path);

    /// <summary>
    /// Sets account-level CORS so browsers on the given origins may PUT directly to blob storage.
    /// Pass an empty collection to allow any origin (<c>*</c>).
    /// </summary>
    Task EnsureCorsAsync(IReadOnlyCollection<string> allowedOrigins);
}
