using FitMate.DB.Entities;
using FitMate.Services.Grids;

namespace FitMate.Services.AdminAI;

internal static class UnsupportedRequestGridColumns
{
    public static readonly IReadOnlyList<GridColumn<UnsupportedAIRequest>> All =
    [
        GridColumn<UnsupportedAIRequest>.Create("requestedFunctionality", x => x.RequestedFunctionality),
        GridColumn<UnsupportedAIRequest>.Create("category", x => x.Category),
        GridColumn<UnsupportedAIRequest>.Create("occurrenceCount", x => x.OccurrenceCount),
        GridColumn<UnsupportedAIRequest>.Create("distinctUserCount",
            x => x.Occurrences.Select(o => o.UserId).Distinct().Count()),
        GridColumn<UnsupportedAIRequest>.Create("status", x => x.Status),
        GridColumn<UnsupportedAIRequest>.Create("lastRequestedAt", x => x.LastRequestedAt.Date,
            value => value.ToString("yyyy-MM-dd")),
        GridColumn<UnsupportedAIRequest>.Create("externalTrackingKey", x => x.ExternalTrackingKey),
    ];
}
