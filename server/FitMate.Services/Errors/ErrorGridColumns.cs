using FitMate.DB.Entities;
using FitMate.Services.Grids;

namespace FitMate.Services.Errors;

internal static class ErrorGridColumns
{
    public static readonly IReadOnlyList<GridColumn<Error>> All =
    [
        GridColumn<Error>.Create("dateCreated", x => x.DateCreated),
        GridColumn<Error>.Create("message", x => x.Message),
        GridColumn<Error>.Create("requestUrl", x => x.RequestUrl),
        GridColumn<Error>.Create("source", x => x.Source),
        GridColumn<Error>.Create("createdByEmail", x => x.CreatedBy == null ? null : x.CreatedBy.Email,
            value => value ?? "Anonymous"),
    ];
}
