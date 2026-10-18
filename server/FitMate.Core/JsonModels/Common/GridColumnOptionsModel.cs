namespace FitMate.Core.JsonModels.Common;

public class GridColumnOptionsModel
{
    public string Field { get; set; } = string.Empty;
    public List<GridFilterOptionModel> Options { get; set; } = [];
}
