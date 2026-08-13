using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using FitMate.Core.Settings;

namespace FitMate.Services.Storage.Blobs;

public class AzureBlobStorageService : IBlobStorageService
{
    /// <summary>
    /// Every blob path carries a timestamp, so the bytes at a path never change — a replacement is
    /// written to a new path. That makes the content safe to cache for as long as a signed URL for
    /// it stays stable, which is what makes an avatar cost one download rather than one per visit.
    /// </summary>
    private const string ImmutableCacheControl = "private, max-age=604800, immutable";

    private readonly ApplicationSettings settings;

    public AzureBlobStorageService(ApplicationSettings settings)
    {
        this.settings = settings;
    }

    public async Task<string> UploadAsync(Stream content, string path, string contentType)
    {
        var container = GetContainerClient();
        await container.CreateIfNotExistsAsync(PublicAccessType.None);

        var blob = container.GetBlobClient(path);

        content.Position = 0;
        await blob.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType,
                CacheControl = ImmutableCacheControl,
            },
        });

        return path;
    }

    public async Task DeleteByPrefixAsync(string prefix)
    {
        var container = GetContainerClient();
        if (!await container.ExistsAsync())
        {
            return;
        }

        await foreach (var blob in container.GetBlobsAsync(prefix: prefix))
        {
            await container.DeleteBlobIfExistsAsync(blob.Name);
        }
    }

    public async Task DeleteAsync(string path)
    {
        var blob = GetContainerClient().GetBlobClient(path);
        await blob.DeleteIfExistsAsync();
    }

    public Task<string> GetReadUrlAsync(string path, TimeSpan? lifetime = null)
    {
        var container = GetContainerClient();
        var blob = container.GetBlobClient(path);

        var window = lifetime ?? TimeSpan.FromMinutes(settings.AzureStorageSasMinutes);

        // Snap the validity to a grid of half the window instead of "now", so every caller inside the
        // same half-window signs the exact same string and gets the exact same URL back. The cost is
        // that a URL handed out at the end of a slot still has half a window left on it.
        var step = TimeSpan.FromTicks(Math.Max(window.Ticks / 2, TimeSpan.TicksPerSecond));
        var slotStart = new DateTimeOffset(
            DateTimeOffset.UtcNow.UtcTicks / step.Ticks * step.Ticks,
            TimeSpan.Zero);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = settings.AzureStorageContainerName,
            BlobName = path,
            Resource = "b",
            StartsOn = slotStart.AddMinutes(-2),
            ExpiresOn = slotStart + window,
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Read);

        if (!blob.CanGenerateSasUri)
        {
            throw new InvalidOperationException(
                "Blob client cannot generate a SAS. Ensure the storage connection string includes an account key.");
        }

        return Task.FromResult(blob.GenerateSasUri(sasBuilder).ToString());
    }

    public async Task<string> GetWriteUrlAsync(string path, string contentType)
    {
        var container = GetContainerClient();
        // The browser PUTs straight to the blob, so the container must exist beforehand.
        await container.CreateIfNotExistsAsync(PublicAccessType.None);

        var blob = container.GetBlobClient(path);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = settings.AzureStorageContainerName,
            BlobName = path,
            Resource = "b",
            StartsOn = DateTimeOffset.UtcNow.AddMinutes(-2),
            ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(settings.AzureStorageSasMinutes),
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);

        if (!blob.CanGenerateSasUri)
        {
            throw new InvalidOperationException(
                "Blob client cannot generate a SAS. Ensure the storage connection string includes an account key.");
        }

        return blob.GenerateSasUri(sasBuilder).ToString();
    }

    public async Task<Stream?> DownloadAsync(string path)
    {
        var blob = GetContainerClient().GetBlobClient(path);

        try
        {
            var stream = new MemoryStream();
            await blob.DownloadToAsync(stream);
            stream.Position = 0;
            return stream;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task EnsureCorsAsync(IReadOnlyCollection<string> allowedOrigins)
    {
        var serviceClient = GetBlobServiceClient();
        var properties = await serviceClient.GetPropertiesAsync();

        var origins = allowedOrigins.Count > 0 ? string.Join(",", allowedOrigins) : "*";

        properties.Value.Cors = new List<BlobCorsRule>
        {
            new()
            {
                AllowedOrigins = origins,
                AllowedMethods = "PUT,GET,HEAD,OPTIONS",
                AllowedHeaders = "*",
                ExposedHeaders = "*",
                MaxAgeInSeconds = 3600,
            },
        };

        await serviceClient.SetPropertiesAsync(properties.Value);
    }

    private BlobContainerClient GetContainerClient()
    {
        return GetBlobServiceClient().GetBlobContainerClient(settings.AzureStorageContainerName);
    }

    private BlobServiceClient GetBlobServiceClient()
    {
        var connectionString = settings.AzureStorageConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "UseDevelopmentStorage=true";
        }

        return new BlobServiceClient(connectionString);
    }
}
