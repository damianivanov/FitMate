using FitMate.Services.Storage.Blobs;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeBlobStorageService : IBlobStorageService
{
    public List<string> UploadedPaths { get; } = [];
    public List<string> DeletedPrefixes { get; } = [];
    public List<string> DeletedPaths { get; } = [];

    public Task<string> UploadAsync(Stream content, string path, string contentType)
    {
        UploadedPaths.Add(path);
        return Task.FromResult(path);
    }

    public Task DeleteByPrefixAsync(string prefix)
    {
        DeletedPrefixes.Add(prefix);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string path)
    {
        DeletedPaths.Add(path);
        return Task.CompletedTask;
    }

    public Task<string> GetReadUrlAsync(string path) => Task.FromResult($"signed://{path}");

    public Task<string> GetWriteUrlAsync(string path, string contentType)
        => Task.FromResult($"signed://write/{path}");

    public Task<Stream?> DownloadAsync(string path) => Task.FromResult<Stream?>(null);

    public Task EnsureCorsAsync(IReadOnlyCollection<string> allowedOrigins) => Task.CompletedTask;
}
