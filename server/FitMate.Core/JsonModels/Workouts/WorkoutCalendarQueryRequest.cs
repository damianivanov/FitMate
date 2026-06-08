using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutCalendarQueryRequest
{
    [Range(1, 9999)]
    public int Year { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }
}
