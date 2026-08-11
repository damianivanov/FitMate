namespace FitMate.Services.AI.Runs;

/// <summary>
/// The conversation already has a run in flight. Overlapping turns would interleave tool traffic
/// and charge quota twice, so the second request is refused rather than queued behind the first.
/// </summary>
public class AIRunAlreadyActiveException : Exception
{
    public AIRunAlreadyActiveException(long conversationId, long activeRunId)
        : base("This conversation is still working on the previous message.")
    {
        ConversationId = conversationId;
        ActiveRunId = activeRunId;
    }

    public long ConversationId { get; }
    public long ActiveRunId { get; }
}
