using FitMate.Core.JsonModels.AdminAI;
using FitMate.Services.Grids;

namespace FitMate.Services.AdminAI;

internal static class ConversationGridColumns
{
    public static readonly IReadOnlyList<GridColumn<AIConversationListItemModel>> All =
    [
        GridColumn<AIConversationListItemModel>.Create("lastMessageAt", x => x.LastMessageAt),
        GridColumn<AIConversationListItemModel>.Create("userEmail", x => x.UserEmail ?? "User " + x.UserId),
        GridColumn<AIConversationListItemModel>.Create("title", x => x.Title),
        GridColumn<AIConversationListItemModel>.Create("status", x => x.Status),
        GridColumn<AIConversationListItemModel>.Create("messageCount", x => x.MessageCount),
        GridColumn<AIConversationListItemModel>.Create("runCount", x => x.RunCount),
        GridColumn<AIConversationListItemModel>.Create("estimatedCost", x => x.EstimatedCost,
            value => $"${value:F4}"),
    ];
}
