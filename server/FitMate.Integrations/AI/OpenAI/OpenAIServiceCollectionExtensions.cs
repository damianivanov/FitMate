using FitMate.Integrations.AI.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Integrations.AI.OpenAI;

public static class OpenAIServiceCollectionExtensions
{
    /// <summary>
    /// Registers the OpenAI-backed providers. The API key comes from configuration
    /// (environment variables or user secrets) and is never committed.
    /// </summary>
    public static IServiceCollection AddFitMateOpenAI(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<OpenAIOptions>(configuration.GetSection(OpenAIOptions.SectionName));
        services.AddScoped<IAICompletionProvider, OpenAICompletionProvider>();
        services.AddScoped<IAIImageProvider, OpenAIImageProvider>();
        services.AddScoped<IAIModelCatalog, OpenAIModelCatalog>();
        return services;
    }
}
