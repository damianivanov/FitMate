using FitMate.Core.JsonModels.TrainingProfiles;

namespace FitMate.Services.TrainingProfiles;

public interface ITrainingProfileService
{
    /// <summary>Returns null until the user saves a profile for the first time.</summary>
    Task<TrainingProfileModel?> GetAsync(long userId);
    Task<TrainingProfileModel> SaveAsync(SaveTrainingProfileRequest request, long userId);
}
