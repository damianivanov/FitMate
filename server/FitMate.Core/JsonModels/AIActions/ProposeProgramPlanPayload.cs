using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AIActions;

/// <summary>
/// A proposed program. Schedule items reference either an existing template id or, by client key,
/// one of the templates proposed alongside them — so a whole program can be described in one call
/// without the model inventing ids.
/// </summary>
public class ProposeProgramPlanPayload
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }

    /// <summary>Null means the program keeps running until the user stops it.</summary>
    public DateOnly? EndDate { get; set; }

    public int WorkoutsPerWeek { get; set; }
    public List<ProposedProgramScheduleItem> Schedule { get; set; } = [];
    public List<ProposedProgramTemplate> NewTemplates { get; set; } = [];
}

public class ProposedProgramScheduleItem
{
    public DayOfWeek? DayOfWeek { get; set; }
    public int? RotationDayIndex { get; set; }
    public ProgramPlanDayType DayType { get; set; } = ProgramPlanDayType.Workout;
    public long? ExistingWorkoutTemplateId { get; set; }
    public string? NewWorkoutTemplateClientKey { get; set; }
    public bool IsOptional { get; set; }
}

public class ProposedProgramTemplate
{
    /// <summary>Model-supplied handle used by schedule items to point at this template.</summary>
    public string ClientKey { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public List<ProposedExercise> Exercises { get; set; } = [];
}
