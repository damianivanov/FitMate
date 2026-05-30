using FitMate.Core.JsonModels.Analytics;

namespace FitMate.Services.Analytics;

public interface IAnalyticsService
{
    Task<AnalyticsOverviewModel> GetOverviewAsync(long userId, AnalyticsQueryRequest request);
    Task<ExerciseProgressionModel> GetExerciseProgressionAsync(long userId, long exerciseId, AnalyticsQueryRequest request);
}
