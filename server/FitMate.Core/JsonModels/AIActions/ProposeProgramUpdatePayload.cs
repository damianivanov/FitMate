namespace FitMate.Core.JsonModels.AIActions;

/// <summary>
/// A reshape of an active program's week. Dates, goal and schedule type stay as they are — only the
/// schedule itself is replaced, and only from tomorrow onwards.
/// </summary>
public class ProposeProgramUpdatePayload
{
    public long ProgramPlanId { get; set; }

    /// <summary>Why the change is being suggested, shown to the user on the confirmation card.</summary>
    public string Reason { get; set; } = string.Empty;

    public int WorkoutsPerWeek { get; set; }
    public List<ProposedProgramScheduleItem> Schedule { get; set; } = [];
    public List<ProposedProgramTemplate> NewTemplates { get; set; } = [];
}
