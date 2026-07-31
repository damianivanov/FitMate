namespace FitMate.Core.JsonModels.AIActions;

/// <summary>A typed, display-ready description of what confirming an action would create.</summary>
public class AIActionPreviewModel
{
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public List<AIActionPreviewLineModel> Lines { get; set; } = [];
}

public class AIActionPreviewLineModel
{
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
