namespace FitMate.Services.Storage.Blobs;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream content, string path, string contentType);

    Task DeleteByPrefixAsync(string prefix);

    Task<string> GetReadUrlAsync(string path);
}
