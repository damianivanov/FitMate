using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAI;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Unsupported;

public class UnsupportedRequestService : IUnsupportedRequestService
{
    private readonly AppDbContext dbContext;

    public UnsupportedRequestService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<long> RecordAsync(RecordUnsupportedRequestRequest request, long userId)
    {
        if (string.IsNullOrWhiteSpace(request.RequestedFunctionality))
        {
            throw new FitMateException("The requested functionality is required.");
        }

        var category = UnsupportedRequestKeyNormalizer.NormalizeCategory(
            string.IsNullOrWhiteSpace(request.Category) ? "other" : request.Category);
        var normalizedKey = UnsupportedRequestKeyNormalizer.Normalize(request.RequestedFunctionality);
        var now = DateTime.UtcNow;

        var group = await dbContext.UnsupportedAIRequests
            .FirstOrDefaultAsync(x => x.Category == category && x.NormalizedKey == normalizedKey);

        if (group == null)
        {
            group = new UnsupportedAIRequest
            {
                UserId = userId,
                ConversationId = request.ConversationId,
                MessageId = request.MessageId,
                Category = category,
                NormalizedKey = normalizedKey,
                RequestedFunctionality = Truncate(request.RequestedFunctionality, 1000)!,
                UserIntentSummary = Truncate(request.UserIntentSummary, 2000),
                SuggestedFallback = Truncate(request.SuggestedFallback, 2000),
                Status = UnsupportedRequestStatus.New,
                OccurrenceCount = 0,
                FirstRequestedAt = now,
                LastRequestedAt = now,
            };
            dbContext.UnsupportedAIRequests.Add(group);
        }

        // Status is admin-owned triage state and is never reset by new reports.
        group.OccurrenceCount++;
        group.LastRequestedAt = now;
        group.Occurrences.Add(new UnsupportedAIRequestOccurrence
        {
            UserId = userId,
            ConversationId = request.ConversationId,
            MessageId = request.MessageId,
        });

        await dbContext.SaveChangesAsync();
        return group.Id;
    }

    private static string? Truncate(string? value, int maxLength) =>
        value != null && value.Length > maxLength ? value[..maxLength] : value;
}
