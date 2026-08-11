namespace FitMate.DB.Enums;

public enum AIRunStatus
{
    Running = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4,
    LimitExceeded = 5,

    /// <summary>Appended, not renumbered: values 1-5 are already persisted in production.</summary>
    Queued = 6,
}
