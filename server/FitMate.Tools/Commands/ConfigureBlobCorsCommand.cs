using FitMate.Services.Storage.Blobs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace FitMate.Tools.Commands;

/// <summary>
/// Sets account-level CORS on the Azure storage account so the browser can PUT exercise images
/// directly to blob storage (the direct-to-storage upload that bypasses the app ingress). Run once
/// per environment; re-run after changing the allowed client origins. Origins are read from
/// <c>Application:AllowedOrigins</c> and <c>Application:ClientUrl</c>; if none are configured the
/// rule falls back to allowing any origin (<c>*</c>).
/// </summary>
public sealed class ConfigureBlobCorsCommand
{
    private readonly IBlobStorageService blobStorage;
    private readonly IConfiguration configuration;
    private readonly ILogger<ConfigureBlobCorsCommand> logger;

    public ConfigureBlobCorsCommand(
        IBlobStorageService blobStorage,
        IConfiguration configuration,
        ILogger<ConfigureBlobCorsCommand> logger)
    {
        this.blobStorage = blobStorage;
        this.configuration = configuration;
        this.logger = logger;
    }

    public async Task<int> RunAsync()
    {
        var origins = ResolveOrigins();

        await blobStorage.EnsureCorsAsync(origins);

        logger.LogInformation(
            "Configured blob CORS (PUT,GET,HEAD,OPTIONS) for origins: {Origins}.",
            origins.Count > 0 ? string.Join(", ", origins) : "* (any)");

        return 0;
    }

    private IReadOnlyCollection<string> ResolveOrigins()
    {
        var configured = configuration.GetSection("Application:AllowedOrigins").Get<string[]>() ?? [];

        return configured
            .Append(configuration["Application:ClientUrl"])
            .Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Select(origin => origin!.Trim().TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
