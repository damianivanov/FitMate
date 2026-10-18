namespace FitMate.Core.JsonModels.Common;

public class GridQueryRequest : PagedRequest
{
    public List<GridColumnSelectionModel>? ColumnFilters { get; set; }
}
