using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using FitMate.Core.Settings;

namespace FitMate.Services.Storage.Blobs;

public class AzureBlobStorageService : IBlobStorageService
{
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
                CacheControl = "private, max-age=0",
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

    public Task<string> GetReadUrlAsync(string path)
    {
        var container = GetContainerClient();
        var blob = container.GetBlobClient(path);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = settings.AzureStorageContainerName,
            BlobName = path,
            Resource = "b",
            StartsOn = DateTimeOffset.UtcNow.AddMinutes(-2),
            ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(settings.AzureStorageSasMinutes),
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Read);

        if (!blob.CanGenerateSasUri)
        {
            throw new InvalidOperationException(
                "Blob client cannot generate a SAS. Ensure the storage connection string includes an account key.");
        }

        return Task.FromResult(blob.GenerateSasUri(sasBuilder).ToString());
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
