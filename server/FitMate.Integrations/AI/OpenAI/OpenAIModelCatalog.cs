using FitMate.Integrations.AI.Abstractions;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Models;
using System.ClientModel;

namespace FitMate.Integrations.AI.OpenAI;

/// <summary>Lists the account's available models through the OpenAI models endpoint.</summary>
public class OpenAIModelCatalog : IAIModelCatalog
{
    private readonly OpenAIOptions options;

    public OpenAIModelCatalog(IOptions<OpenAIOptions> options)
    {
        this.options = options.Value;
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(
        CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            throw new InvalidOperationException("The OpenAI API key is not configured.");
        }

        var client = CreateClient();
        var models = await client.GetModelsAsync(cancellationToken);

        return models.Value
            .Select(model => model.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private OpenAIModelClient CreateClient()
    {
        var credential = new ApiKeyCredential(options.ApiKey);

        if (string.IsNullOrWhiteSpace(options.Endpoint))
        {
            return new OpenAIModelClient(credential);
        }

        return new OpenAIModelClient(credential, new OpenAIClientOptions
        {
            Endpoint = new Uri(options.Endpoint),
        });
    }
}
