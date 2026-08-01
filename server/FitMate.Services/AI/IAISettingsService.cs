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

    void Invalidate();
}
