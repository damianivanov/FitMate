using FitMate.Integrations.AI.Abstractions;
using FitMate.Integrations.AI.Models;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Images;
using System.ClientModel;

namespace FitMate.Integrations.AI.OpenAI;

public class OpenAIImageProvider : IAIImageProvider
{
    private readonly OpenAIOptions options;

    public OpenAIImageProvider(IOptions<OpenAIOptions> options)
    {
        this.options = options.Value;
    }

    public async Task<AIGeneratedImageResult> GenerateAsync(
        AIImageGenerationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            throw new InvalidOperationException("The OpenAI API key is not configured.");
        }

        var client = CreateClient(request.Model);
        var generationOptions = new ImageGenerationOptions
        {
            Size = new GeneratedImageSize(request.Width, request.Height),
            ResponseFormat = GeneratedImageFormat.Bytes,
        };

        ClientResult<GeneratedImage> result = await client.GenerateImageAsync(
            request.Prompt,
            generationOptions,
            cancellationToken);

        return new AIGeneratedImageResult
        {
            Content = result.Value.ImageBytes?.ToArray() ?? [],
            ContentType = "image/png",
            Model = request.Model,
        };
    }

    private ImageClient CreateClient(string model)
    {
        var credential = new ApiKeyCredential(options.ApiKey);

        if (string.IsNullOrWhiteSpace(options.Endpoint))
        {
            return new ImageClient(model, credential);
        }

        return new ImageClient(model, credential, new OpenAIClientOptions
        {
            Endpoint = new Uri(options.Endpoint),
        });
    }
}
