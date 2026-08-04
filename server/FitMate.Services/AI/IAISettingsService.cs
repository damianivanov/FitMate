using FitMate.Core.JsonModels.AdminAI;

namespace FitMate.Services.AI;

/// <summary>
/// Effective global AI configuration: the stored row when one exists, otherwise the appsettings
/// values the app was deployed with.
/// </summary>
public interface IAISettingsService
{
    Task<AISettingsModel> GetAsync();

    Task<AISettingsModel> SaveAsync(SaveAISettingsRequest request);

    /// <summary>
    /// Model ids the provider currently offers, for the admin pickers. Empty when the provider is
    /// unconfigured or unreachable, so the UI can fall back to free text instead of breaking.
    /// </summary>
    Task<IReadOnlyList<string>> ListAvailableModelsAsync();

    void Invalidate();
}
