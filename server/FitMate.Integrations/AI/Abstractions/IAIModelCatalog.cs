namespace FitMate.Integrations.AI.Abstractions;

/// <summary>
/// The model ids the configured provider currently exposes. Read from the provider rather than
/// hard-coded, so the list never drifts out of date as models are added or retired.
/// </summary>
public interface IAIModelCatalog
{
    Task<IReadOnlyList<string>> ListModelsAsync(CancellationToken cancellationToken = default);
}
