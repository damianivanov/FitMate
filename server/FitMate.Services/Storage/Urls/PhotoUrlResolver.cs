using FitMate.Services.Storage.Blobs;

namespace FitMate.Services.Storage.Urls;

public class PhotoUrlResolver : IPhotoUrlResolver
{
    private readonly IBlobStorageService storage;

    public PhotoUrlResolver(IBlobStorageService storage)
    {
        this.storage = storage;
    }

    public async Task<string?> ResolveAsync(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        var trimmed = value.Trim();
        if (!BlobPathBuilder.IsOwnedBlobPath(trimmed))
        {
            return trimmed;
        }

        return await storage.GetReadUrlAsync(trimmed);
    }
}
