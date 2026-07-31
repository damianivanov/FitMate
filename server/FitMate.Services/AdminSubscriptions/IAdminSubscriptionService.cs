using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminSubscriptions;

public interface IAdminSubscriptionService
{
    Task<PagedResponse<UserSubscriptionAdminModel>> ListAsync(SubscriptionQueryRequest request);

    Task<UserSubscriptionAdminModel?> GetByUserIdAsync(long userId);

    /// <summary>Replaces any active override for the user with a new one.</summary>
    Task<UserSubscriptionAdminModel> AssignOverrideAsync(
        long userId,
        AssignPlanOverrideRequest request,
        long adminUserId);

    Task<UserSubscriptionAdminModel> RemoveOverrideAsync(long userId);

    Task<PagedResponse<UserUsageAdminModel>> ListUsageAsync(UsageQueryRequest request);

    /// <summary>Zeroes a usage bucket, e.g. after a failed run burned a user's quota.</summary>
    Task<UserUsageAdminModel> ResetUsageAsync(long usageBucketId);
}
