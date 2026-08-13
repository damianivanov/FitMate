namespace FitMate.Services.Storage.Urls;

public interface IPhotoUrlResolver
{
    /// <summary>
    /// Turns a stored value into something the browser can render: an owned blob path becomes a
    /// signed URL, an external URL passes through untouched. <paramref name="lifetime"/> widens how
    /// long that signed URL stays valid — and, because signatures are issued on a fixed grid, how
    /// long it stays identical and therefore cacheable.
    /// </summary>
    Task<string?> ResolveAsync(string? value, TimeSpan? lifetime = null);
}
