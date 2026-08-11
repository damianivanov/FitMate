namespace FitMate.Services.AI.Runs;

public class AIRunOptions
{
    public const string SectionName = "AI:AsyncRuns";

    /// <summary>Turn off on an instance that should serve HTTP only. There is no second orchestration path.</summary>
    public bool WorkerEnabled { get; set; } = true;

    public int PollIntervalMilliseconds { get; set; } = 500;

    /// <summary>Must exceed one provider timeout plus margin, or a live run is reclaimed under itself.</summary>
    public int LeaseSeconds { get; set; } = 180;

    /// <summary>Attempts allowed only while the run has produced no side effects.</summary>
    public int MaximumSafeAttempts { get; set; } = 2;

    public int RetryBackoffSeconds { get; set; } = 5;
}
