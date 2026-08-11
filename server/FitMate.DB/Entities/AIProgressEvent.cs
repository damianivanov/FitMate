using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

/// <summary>
/// One sanitized stage of a run. <see cref="Base.BaseEntity.Id"/> is the replay cursor, so rows are
/// append-only and never updated. Codes are stable identifiers the client maps to copy.
/// </summary>
public class AIProgressEvent : BaseEntity
{
    public long AIRunId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? ToolName { get; set; }

    public AIRun AIRun { get; set; } = null!;
}
