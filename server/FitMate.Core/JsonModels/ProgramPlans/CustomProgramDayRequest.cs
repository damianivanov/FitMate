using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class CustomProgramDayRequest
{
    public DateOnly Date { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }

    [StringLength(1000)]
    public string? Notes { get; set; }
}
