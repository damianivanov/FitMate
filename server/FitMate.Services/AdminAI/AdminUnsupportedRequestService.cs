using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminAI;

public class AdminUnsupportedRequestService : IAdminUnsupportedRequestService
{
    private const int RecentOccurrenceCount = 10;

    private readonly AppDbContext dbContext;

    public AdminUnsupportedRequestService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<PagedResponse<UnsupportedAIRequestModel>> ListAsync(UnsupportedRequestQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.UnsupportedAIRequests.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.RequestedFunctionality.Contains(search)
                || x.NormalizedKey.Contains(search)
                || (x.UserIntentSummary != null && x.UserIntentSummary.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            query = query.Where(x => x.Category == request.Category);
        }

        if (request.Status is { } status)
        {
            query = query.Where(x => x.Status == status);
        }

        // Most-wanted first: demand is the reason this backlog exists.
        query = query
            .OrderByDescending(x => x.OccurrenceCount)
            .ThenByDescending(x => x.LastRequestedAt)
            .ThenByDescending(x => x.Id);

        var totalCount = await query.CountAsync();
        var groups = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var ids = groups.Select(x => x.Id).ToList();
        var distinctUsers = await dbContext.UnsupportedAIRequestOccurrences
            .AsNoTracking()
            .Where(x => ids.Contains(x.UnsupportedAIRequestId))
            .GroupBy(x => x.UnsupportedAIRequestId)
            .Select(group => new { GroupId = group.Key, Users = group.Select(x => x.UserId).Distinct().Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Users);

        return new PagedResponse<UnsupportedAIRequestModel>
        {
            Items = groups
                .Select(group => ToModel(group, distinctUsers.GetValueOrDefault(group.Id)))
                .ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UnsupportedAIRequestModel?> GetByIdAsync(long id)
    {
        var group = await dbContext.UnsupportedAIRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (group == null)
        {
            return null;
        }

        var occurrences = await dbContext.UnsupportedAIRequestOccurrences
            .AsNoTracking()
            .Where(x => x.UnsupportedAIRequestId == id)
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .Take(RecentOccurrenceCount)
            .ToListAsync();

        var distinctUsers = await dbContext.UnsupportedAIRequestOccurrences
            .AsNoTracking()
            .Where(x => x.UnsupportedAIRequestId == id)
            .Select(x => x.UserId)
            .Distinct()
            .CountAsync();

        var userIds = occurrences.Select(x => x.UserId).Distinct().ToList();
        var emails = await dbContext.Users
            .AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Email })
            .ToDictionaryAsync(x => x.Id, x => x.Email);

        var model = ToModel(group, distinctUsers);
        model.RecentOccurrences = occurrences
            .Select(occurrence => new UnsupportedRequestOccurrenceModel
            {
                Id = occurrence.Id,
                UserId = occurrence.UserId,
                UserEmail = emails.GetValueOrDefault(occurrence.UserId),
                ConversationId = occurrence.ConversationId,
                ReportedAt = occurrence.DateCreated,
            })
            .ToList();

        return model;
    }

    public async Task<UnsupportedAIRequestModel> UpdateAsync(long id, UpdateUnsupportedRequestRequest request)
    {
        var group = await dbContext.UnsupportedAIRequests.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new FitMateException("Unsupported request not found.");

        group.Status = request.Status;
        group.AdminNotes = request.AdminNotes;
        group.ExternalTrackingUrl = request.ExternalTrackingUrl;
        group.ExternalTrackingKey = request.ExternalTrackingKey;
        await dbContext.SaveChangesAsync();

        return (await GetByIdAsync(id))!;
    }

    public async Task<IReadOnlyList<string>> GetCategoriesAsync() =>
        await dbContext.UnsupportedAIRequests
            .AsNoTracking()
            .Select(x => x.Category)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

    private static UnsupportedAIRequestModel ToModel(UnsupportedAIRequest group, int distinctUserCount) => new()
    {
        Id = group.Id,
        Category = group.Category,
        NormalizedKey = group.NormalizedKey,
        RequestedFunctionality = group.RequestedFunctionality,
        UserIntentSummary = group.UserIntentSummary,
        SuggestedFallback = group.SuggestedFallback,
        Status = group.Status,
        OccurrenceCount = group.OccurrenceCount,
        DistinctUserCount = distinctUserCount,
        FirstRequestedAt = group.FirstRequestedAt,
        LastRequestedAt = group.LastRequestedAt,
        AdminNotes = group.AdminNotes,
        ExternalTrackingUrl = group.ExternalTrackingUrl,
        ExternalTrackingKey = group.ExternalTrackingKey,
    };
}
