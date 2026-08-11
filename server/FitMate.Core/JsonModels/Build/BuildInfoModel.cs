namespace FitMate.Core.JsonModels.Build;

public class BuildInfoModel
{
    /// <summary>When the running assembly was compiled. Null if the stamp could not be read.</summary>
    public DateTime? BuildTimeUtc { get; set; }

    public string Version { get; set; } = string.Empty;

    /// <summary>Only present when the build injected a GIT_COMMIT value.</summary>
    public string? CommitSha { get; set; }

    public string EnvironmentName { get; set; } = string.Empty;

    /// <summary>Process start, so a restart is distinguishable from a redeploy.</summary>
    public DateTime? StartedAtUtc { get; set; }
}
