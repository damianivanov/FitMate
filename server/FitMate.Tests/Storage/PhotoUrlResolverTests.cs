using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Urls;

namespace FitMate.Tests.Storage;

public class PhotoUrlResolverTests
{
    private sealed class FakeBlobStorageService : IBlobStorageService
    {
        public int ReadUrlCallCount { get; private set; }
        public string? LastRequestedPath { get; private set; }

        public Task<string> UploadAsync(Stream content, string path, string contentType)
            => throw new NotSupportedException();

        public Task DeleteByPrefixAsync(string prefix) => throw new NotSupportedException();

        public Task<string> GetReadUrlAsync(string path)
        {
            ReadUrlCallCount++;
            LastRequestedPath = path;
            return Task.FromResult($"https://account.blob.core.windows.net/media/{path}?sv=2024&sig=fake&sp=r");
        }
    }

    // Null стойност връща null без сигниране
    [Fact]
    public async Task ResolveAsync_ReturnsNullForNullOrWhitespace()
    {
        var storage = new FakeBlobStorageService();
        var resolver = new PhotoUrlResolver(storage);

        Assert.Null(await resolver.ResolveAsync(null));
        Assert.Equal(0, storage.ReadUrlCallCount);
    }

    // Външни и относителни URL-та минават непроменени
    [Theory]
    [InlineData("https://fitnessbuddy.blob.core.windows.net/fitness-buddy/exercise-templates/x.jpg")]
    [InlineData("http://example.com/video.mp4")]
    [InlineData("/images/muscle-groups/abs.png")]
    public async Task ResolveAsync_PassesThroughExternalAndRelativeUrls(string value)
    {
        var storage = new FakeBlobStorageService();
        var resolver = new PhotoUrlResolver(storage);

        var result = await resolver.ResolveAsync(value);

        Assert.Equal(value, result);
        Assert.Equal(0, storage.ReadUrlCallCount);
    }

    // Собствен blob път се сигнира точно веднъж
    [Fact]
    public async Task ResolveAsync_SignsOwnedBlobPathExactlyOnce()
    {
        var storage = new FakeBlobStorageService();
        var resolver = new PhotoUrlResolver(storage);
        const string blobPath = "exercises/42/20260530T192011921Z-bench.jpg";

        var result = await resolver.ResolveAsync(blobPath);

        Assert.Equal(1, storage.ReadUrlCallCount);
        Assert.Equal(blobPath, storage.LastRequestedPath);
        Assert.Contains("sig=fake", result);
    }
}
