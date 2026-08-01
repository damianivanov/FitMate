using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminAI;

public interface IAdminAIService
{
    Task<AIAdminOverviewModel> GetOverviewAsync(int days);

    Task<PagedResponse<AIConversationListItemModel>> ListConversationsAsync(AIConversationQueryRequest request);

    Task<AIConversationDetailModel?> GetConversationAsync(long conversationId);

    Task<PagedResponse<AIAdminRunModel>> ListRunsAsync(AIRunQueryRequest request);

    Task<AIAdminRunModel?> GetRunAsync(long runId);

    Task<AIAdminUsageSummaryModel> GetUsageAsync(DateOnly? periodStart);

    Task<AICostSummaryModel> GetCostsAsync(int days);

    /// <summary>Per-user token spend over the window, each row broken down by model.</summary>
    Task<PagedResponse<AIUserCostBreakdownModel>> GetUserCostsAsync(AIUserCostQueryRequest request);
}
