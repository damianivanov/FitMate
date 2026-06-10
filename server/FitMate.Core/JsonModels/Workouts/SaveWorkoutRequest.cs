using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Workouts;

public class SaveWorkoutRequest
{
    public long? WorkoutId { get; set; }
    public long? WorkoutTemplateId { get; set; }

    [Required(AllowEmptyStrings = true)]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }

    public List<CreateWorkoutExerciseRequest> Exercises { get; set; } = [];
}
