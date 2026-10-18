using FitMate.DB.Entities;
using FitMate.Services.Grids;

namespace FitMate.Services.MuscleGroups;

internal static class MuscleGroupGridColumns
{
    public static readonly IReadOnlyList<GridColumn<MuscleGroup>> All =
    [
        GridColumn<MuscleGroup>.Create("name", x => x.Name),
        GridColumn<MuscleGroup>.Create("imageUrl", x => x.ImageUrl != null && x.ImageUrl != "",
            value => value ? "Has image" : "No image"),
    ];
}
