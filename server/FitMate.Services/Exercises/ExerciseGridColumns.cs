using FitMate.DB.Entities;
using FitMate.Services.Grids;

namespace FitMate.Services.Exercises;

internal static class ExerciseGridColumns
{
    public static readonly IReadOnlyList<GridColumn<Exercise>> All =
    [
        GridColumn<Exercise>.Create("name", x => x.Name),
        GridColumn<Exercise>.Create("slug", x => x.Slug),
        GridColumn<Exercise>.Create("lastUsedAt", x => x.WorkoutExercises
            .Where(w => w.Sets.Any(s => s.IsCompleted))
            .OrderByDescending(w => w.WorkoutExerciseGroup.Workout.StartedAt
                ?? w.WorkoutExerciseGroup.Workout.FinishedAt ?? w.DateCreated)
            .ThenByDescending(w => w.WorkoutExerciseGroup.WorkoutId).ThenByDescending(w => w.Id)
            .Select(w => (DateTime?)(w.WorkoutExerciseGroup.Workout.StartedAt
                ?? w.WorkoutExerciseGroup.Workout.FinishedAt ?? w.DateCreated).Date)
            .FirstOrDefault(), value => value?.ToString("yyyy-MM-dd") ?? "Never"),
        GridColumn<Exercise>.Create("lastUsedByDisplayName", x => x.WorkoutExercises
            .Where(w => w.Sets.Any(s => s.IsCompleted))
            .OrderByDescending(w => w.WorkoutExerciseGroup.Workout.StartedAt
                ?? w.WorkoutExerciseGroup.Workout.FinishedAt ?? w.DateCreated)
            .ThenByDescending(w => w.WorkoutExerciseGroup.WorkoutId).ThenByDescending(w => w.Id)
            .Select(w => ((w.WorkoutExerciseGroup.Workout.User.FirstName ?? "") + " "
                + (w.WorkoutExerciseGroup.Workout.User.LastName ?? "")).Trim() != ""
                ? ((w.WorkoutExerciseGroup.Workout.User.FirstName ?? "") + " "
                    + (w.WorkoutExerciseGroup.Workout.User.LastName ?? "")).Trim()
                : w.WorkoutExerciseGroup.Workout.User.Email)
            .FirstOrDefault()),
        GridColumn<Exercise>.Create("primaryMuscleGroupId", x => x.PrimaryMuscleGroup.Name),
        GridColumn<Exercise>.Create("secondaryMuscleGroupId",
            x => x.SecondaryMuscleGroup == null ? null : x.SecondaryMuscleGroup.Name,
            value => value ?? "None"),
        GridColumn<Exercise>.Create("loadBasis", x => x.LoadBasis,
            value => value == DB.Enums.ExerciseLoadBasis.PerSide ? "Per side"
                : value == DB.Enums.ExerciseLoadBasis.Total ? "Total" : "—"),
        GridColumn<Exercise>.Create("dateModified", x => x.DateModified.HasValue
            ? (DateTime?)x.DateModified.Value.Date : null,
            value => value?.ToString("yyyy-MM-dd") ?? "—"),
        GridColumn<Exercise>.Create("creatorDisplayName", x => x.UserId == null ? "System"
            : x.User == null ? null
            : ((x.User.FirstName ?? "") + " " + (x.User.LastName ?? "")).Trim() != ""
                ? ((x.User.FirstName ?? "") + " " + (x.User.LastName ?? "")).Trim() : x.User.Email),
    ];
}
