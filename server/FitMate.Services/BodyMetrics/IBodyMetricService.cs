using FitMate.Core.JsonModels.BodyMetrics;

namespace FitMate.Services.BodyMetrics;

public interface IBodyMetricService
{
    Task<IReadOnlyList<BodyMetricEntryModel>> ListAsync(long userId);
    Task<BodyMetricEntryModel> LogAsync(LogBodyMetricRequest request, long userId);
    Task<bool> DeleteAsync(long id, long userId);
}
