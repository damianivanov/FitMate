using FitMate.Core.JsonModels.AdminSubscriptions;

namespace FitMate.Services.AdminSubscriptions;

public interface IAdminSubscriptionPlanService
{
    Task<IReadOnlyList<SubscriptionPlanAdminModel>> ListAsync();

    Task<SubscriptionPlanAdminModel?> GetByIdAsync(long planId);

    Task<SubscriptionPlanAdminModel> CreateAsync(SavePlanRequest request);

    Task<SubscriptionPlanAdminModel> UpdateAsync(long planId, SavePlanRequest request);

    /// <summary>Deactivates rather than deletes: existing subscribers keep resolving their plan.</summary>
    Task<SubscriptionPlanAdminModel> SetActiveAsync(long planId, bool isActive);
}
