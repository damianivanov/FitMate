namespace FitMate.Core.JsonModels.AIActions;

/// <summary>
/// Warnings may be confirmed by the user; errors may not. Duplicate candidates let the card show
/// "you may already have this" before anything is created.
/// </summary>
public class AIActionValidationSummaryModel
{
    public List<string> Warnings { get; set; } = [];
    public List<string> Errors { get; set; } = [];
    public List<DuplicateCandidateModel> DuplicateCandidates { get; set; } = [];
}

public class DuplicateCandidateModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Reason { get; set; }
}
