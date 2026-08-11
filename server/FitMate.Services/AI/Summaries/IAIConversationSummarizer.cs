namespace FitMate.Services.AI.Summaries;

/// <summary>
/// Rolls messages that have fallen outside the retained context window into a bounded summary, so a
/// long conversation keeps its earlier goals and constraints without replaying every message.
/// </summary>
public interface IAIConversationSummarizer
{
    /// <summary>
    /// Returns the summary to prepend, updating it first if new messages have aged out. Never
    /// throws: a failed summary degrades context, it must not fail the user's message.
    /// </summary>
    Task<string?> EnsureSummaryAsync(
        long conversationId,
        long userId,
        AIBudget budget,
        long? runId,
        CancellationToken cancellationToken);
}
