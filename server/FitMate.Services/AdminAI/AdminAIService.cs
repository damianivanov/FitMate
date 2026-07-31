using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminAI;

/// <summary>
/// Read-only aggregation over the AI audit tables. Money columns are summed in memory rather than
/// in SQL: Sqlite (used by the tests) cannot aggregate decimals.
/// </summary>
public class AdminAIService : IAdminAIService
{
    private const string HiddenContentPlaceholder = "[content hidden by user preference]";
    private const int TopListSize = 10;

    private readonly AppDbContext dbContext;
    private readonly IAIRedactionService redactionService;

    public AdminAIService(AppDbContext dbContext, IAIRedactionService redactionService)
    {
        this.dbContext = dbContext;
        this.redactionService = redactionService;
    }

    public async Task<AIAdminOverviewModel> GetOverviewAsync(int days)
    {
        var window = days is <= 0 or > 365 ? 30 : days;
        var to = DateTime.UtcNow;
        var from = to.AddDays(-window);

        var runs = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => x.StartedAt >= from)
            .Select(x => new
            {
                x.UserId,
                x.Status,
                x.InputTokens,
                x.OutputTokens,
                x.EstimatedCost,
                x.DurationMilliseconds,
                x.StartedAt,
            })
            .ToListAsync();

        var durations = runs.Select(x => x.DurationMilliseconds).OrderBy(x => x).ToList();

        var toolStats = await dbContext.AIToolExecutions
            .AsNoTracking()
            .Where(x => x.StartedAt >= from)
            .GroupBy(x => x.ToolName)
            .Select(group => new AIToolUsageModel
            {
                ToolName = group.Key,
                CallCount = group.Count(),
                FailureCount = group.Count(x =>
                    x.Status == AIToolExecutionStatus.Failed
                    || x.Status == AIToolExecutionStatus.Rejected),
                AverageDurationMilliseconds = (int)group.Average(x => x.DurationMilliseconds),
            })
            .OrderByDescending(x => x.CallCount)
            .Take(TopListSize)
            .ToListAsync();

        var emails = await GetEmailsAsync(runs.Select(x => x.UserId));

        var unsupported = await dbContext.UnsupportedAIRequests
            .AsNoTracking()
            .GroupBy(x => x.Category)
            .Select(group => new UnsupportedCategoryCountModel
            {
                Category = group.Key,
                GroupCount = group.Count(),
                OccurrenceCount = group.Sum(x => x.OccurrenceCount),
            })
            .OrderByDescending(x => x.OccurrenceCount)
            .Take(TopListSize)
            .ToListAsync();

        return new AIAdminOverviewModel
        {
            Days = window,
            From = from,
            To = to,
            TotalRuns = runs.Count,
            FailedRuns = runs.Count(x => x.Status == AIRunStatus.Failed),
            ActiveUsers = runs.Select(x => x.UserId).Distinct().Count(),
            Conversations = await dbContext.AIConversations.CountAsync(x => x.DateCreated >= from),
            Messages = await dbContext.AIMessages.CountAsync(x => x.DateCreated >= from),
            ToolCalls = await dbContext.AIToolExecutions.CountAsync(x => x.StartedAt >= from),
            FailedToolCalls = await dbContext.AIToolExecutions
                .CountAsync(x => x.StartedAt >= from
                    && (x.Status == AIToolExecutionStatus.Failed
                        || x.Status == AIToolExecutionStatus.Rejected)),
            ProposedActions = await dbContext.AIActions.CountAsync(x => x.DateCreated >= from),
            ConfirmedActions = await dbContext.AIActions
                .CountAsync(x => x.DateCreated >= from && x.Status == AIActionStatus.Executed),
            InputTokens = runs.Sum(x => (long)x.InputTokens),
            OutputTokens = runs.Sum(x => (long)x.OutputTokens),
            EstimatedCost = runs.Sum(x => x.EstimatedCost ?? 0m),
            AverageDurationMilliseconds = durations.Count == 0 ? 0 : (int)durations.Average(),
            P95DurationMilliseconds = Percentile(durations, 0.95),
            TopTools = toolStats,
            TopUsersByCost = runs
                .GroupBy(x => x.UserId)
                .Select(group => new AIUserCostModel
                {
                    UserId = group.Key,
                    Email = emails.GetValueOrDefault(group.Key),
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(x => x.EstimatedCost ?? 0m),
                })
                .OrderByDescending(x => x.EstimatedCost)
                .Take(TopListSize)
                .ToList(),
            CostByDay = runs
                .GroupBy(x => DateOnly.FromDateTime(x.StartedAt))
                .Select(group => new AICostByDayModel
                {
                    Date = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(x => x.EstimatedCost ?? 0m),
                })
                .OrderBy(x => x.Date)
                .ToList(),
            TopUnsupportedCategories = unsupported,
        };
    }

    public async Task<PagedResponse<AIConversationListItemModel>> ListConversationsAsync(
        AIConversationQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.AIConversations.AsNoTracking().AsQueryable();

        // Titles are model-written summaries, never message bodies, so they are safe to search.
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                (x.Title != null && x.Title.Contains(search)) || x.User.Email!.Contains(search));
        }

        if (request.UserId is { } userId)
        {
            query = query.Where(x => x.UserId == userId);
        }

        if (request.Status is { } status)
        {
            query = query.Where(x => x.Status == status);
        }

        if (request.From is { } from)
        {
            query = query.Where(x => x.LastMessageAt >= from);
        }

        if (request.To is { } to)
        {
            query = query.Where(x => x.LastMessageAt <= to);
        }

        var totalCount = await query.CountAsync();
        var conversations = await query
            .OrderByDescending(x => x.LastMessageAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AIConversationListItemModel
            {
                Id = x.Id,
                UserId = x.UserId,
                UserEmail = x.User.Email,
                Title = x.Title,
                Status = x.Status,
                MessageCount = x.Messages.Count,
                LastMessageAt = x.LastMessageAt,
                DateCreated = x.DateCreated,
            })
            .ToListAsync();

        var ids = conversations.Select(x => x.Id).ToList();
        var runs = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => ids.Contains(x.ConversationId))
            .Select(x => new { x.ConversationId, x.EstimatedCost })
            .ToListAsync();

        foreach (var conversation in conversations)
        {
            var conversationRuns = runs.Where(x => x.ConversationId == conversation.Id).ToList();
            conversation.RunCount = conversationRuns.Count;
            conversation.EstimatedCost = conversationRuns.Sum(x => x.EstimatedCost ?? 0m);
        }

        return new PagedResponse<AIConversationListItemModel>
        {
            Items = conversations,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<AIConversationDetailModel?> GetConversationAsync(long conversationId)
    {
        var conversation = await dbContext.AIConversations
            .AsNoTracking()
            .Where(x => x.Id == conversationId)
            .Select(x => new
            {
                x.Id,
                x.UserId,
                Email = x.User.Email,
                x.Title,
                x.Status,
                x.LastMessageAt,
                x.DateCreated,
            })
            .FirstOrDefaultAsync();

        if (conversation == null)
        {
            return null;
        }

        // Opting out of admin content review hides bodies but keeps the audit trail visible.
        var contentVisible = await dbContext.UserAIPreferences
            .AsNoTracking()
            .Where(x => x.UserId == conversation.UserId)
            .Select(x => (bool?)x.AllowAdminContentReview)
            .FirstOrDefaultAsync() ?? true;

        var messages = await dbContext.AIMessages
            .AsNoTracking()
            .Where(x => x.ConversationId == conversationId)
            .OrderBy(x => x.DateCreated)
            .ThenBy(x => x.Id)
            .Select(x => new AIAdminMessageModel
            {
                Id = x.Id,
                Role = x.Role,
                Content = x.Content,
                ToolName = x.ToolName,
                DateCreated = x.DateCreated,
            })
            .ToListAsync();

        foreach (var message in messages)
        {
            message.Content = contentVisible
                ? redactionService.RedactText(message.Content)
                : HiddenContentPlaceholder;
        }

        var runs = await LoadRunsAsync(
            dbContext.AIRuns.AsNoTracking().Where(x => x.ConversationId == conversationId));

        var actions = await dbContext.AIActions
            .AsNoTracking()
            .Where(x => x.ConversationId == conversationId)
            .OrderBy(x => x.Id)
            .Select(x => new AIAdminActionModel
            {
                Id = x.Id,
                ActionType = x.ActionType,
                Status = x.Status,
                DateCreated = x.DateCreated,
                ExecutedAt = x.ExecutedAt,
                FailureReason = x.FailureReason,
            })
            .ToListAsync();

        return new AIConversationDetailModel
        {
            Id = conversation.Id,
            UserId = conversation.UserId,
            UserEmail = conversation.Email,
            Title = conversation.Title,
            Status = conversation.Status,
            LastMessageAt = conversation.LastMessageAt,
            DateCreated = conversation.DateCreated,
            ContentVisible = contentVisible,
            Messages = messages,
            Runs = runs,
            Actions = actions,
        };
    }

    public async Task<PagedResponse<AIAdminRunModel>> ListRunsAsync(AIRunQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var query = dbContext.AIRuns.AsNoTracking().AsQueryable();

        if (request.UserId is { } userId)
        {
            query = query.Where(x => x.UserId == userId);
        }

        if (request.ConversationId is { } conversationId)
        {
            query = query.Where(x => x.ConversationId == conversationId);
        }

        if (request.Status is { } status)
        {
            query = query.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Model))
        {
            query = query.Where(x => x.Model == request.Model);
        }

        if (request.From is { } from)
        {
            query = query.Where(x => x.StartedAt >= from);
        }

        if (request.To is { } to)
        {
            query = query.Where(x => x.StartedAt <= to);
        }

        if (request.FailuresOnly)
        {
            query = query.Where(x => x.Status == AIRunStatus.Failed);
        }

        var totalCount = await query.CountAsync();
        var runs = await LoadRunsAsync(query
            .OrderByDescending(x => x.StartedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize));

        return new PagedResponse<AIAdminRunModel>
        {
            Items = runs,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<AIAdminRunModel?> GetRunAsync(long runId)
    {
        var runs = await LoadRunsAsync(dbContext.AIRuns.AsNoTracking().Where(x => x.Id == runId));
        return runs.FirstOrDefault();
    }

    public async Task<AIAdminUsageSummaryModel> GetUsageAsync(DateOnly? periodStart)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = periodStart ?? new DateOnly(today.Year, today.Month, 1);

        var buckets = await dbContext.UsageBuckets
            .AsNoTracking()
            .Where(x => x.PeriodStart == start)
            .Select(x => new { x.Feature, x.UserId, x.Used, x.EffectiveLimit })
            .ToListAsync();

        return new AIAdminUsageSummaryModel
        {
            Period = start.ToString("yyyy-MM"),
            Features = buckets
                .GroupBy(x => x.Feature)
                .Select(group => new AIAdminFeatureUsageModel
                {
                    Feature = group.Key,
                    UserCount = group.Select(x => x.UserId).Distinct().Count(),
                    UsedTotal = group.Sum(x => x.Used),
                    AtOrOverLimitCount = group.Count(x => x.EffectiveLimit != null && x.Used >= x.EffectiveLimit),
                })
                .OrderByDescending(x => x.UsedTotal)
                .ToList(),
        };
    }

    public async Task<AICostSummaryModel> GetCostsAsync(int days)
    {
        var window = days is <= 0 or > 365 ? 30 : days;
        var to = DateTime.UtcNow;
        var from = to.AddDays(-window);

        var runs = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => x.StartedAt >= from)
            .Select(x => new
            {
                x.UserId,
                x.Model,
                x.InputTokens,
                x.OutputTokens,
                x.CachedInputTokens,
                x.EstimatedCost,
                x.StartedAt,
            })
            .ToListAsync();

        var userIds = runs.Select(x => x.UserId).Distinct().ToList();
        var planCodes = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId) && x.Status == SubscriptionStatus.Active)
            .Select(x => new { x.UserId, x.Plan.Code })
            .ToDictionaryAsync(x => x.UserId, x => x.Code);

        return new AICostSummaryModel
        {
            From = from,
            To = to,
            EstimatedCost = runs.Sum(x => x.EstimatedCost ?? 0m),
            InputTokens = runs.Sum(x => (long)x.InputTokens),
            OutputTokens = runs.Sum(x => (long)x.OutputTokens),
            CachedInputTokens = runs.Sum(x => (long)x.CachedInputTokens),
            ByDay = runs
                .GroupBy(x => DateOnly.FromDateTime(x.StartedAt))
                .Select(group => new AICostByDayModel
                {
                    Date = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(x => x.EstimatedCost ?? 0m),
                })
                .OrderBy(x => x.Date)
                .ToList(),
            ByModel = runs
                .GroupBy(x => x.Model)
                .Select(group => new AICostByModelModel
                {
                    Model = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(x => x.EstimatedCost ?? 0m),
                })
                .OrderByDescending(x => x.EstimatedCost)
                .ToList(),
            // Users with no active subscription are on the free plan by definition.
            ByPlan = runs
                .GroupBy(x => planCodes.GetValueOrDefault(x.UserId, "free"))
                .Select(group => new AICostByPlanModel
                {
                    PlanCode = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(x => x.EstimatedCost ?? 0m),
                })
                .OrderByDescending(x => x.EstimatedCost)
                .ToList(),
        };
    }

    private async Task<List<AIAdminRunModel>> LoadRunsAsync(IQueryable<DB.Entities.AIRun> query)
    {
        var runs = await query
            .Select(x => new AIAdminRunModel
            {
                Id = x.Id,
                UserId = x.UserId,
                ConversationId = x.ConversationId,
                Status = x.Status,
                Provider = x.Provider,
                Model = x.Model,
                PromptVersion = x.PromptVersion,
                InputTokens = x.InputTokens,
                OutputTokens = x.OutputTokens,
                CachedInputTokens = x.CachedInputTokens,
                EstimatedCost = x.EstimatedCost,
                ToolCallCount = x.ToolCallCount,
                DurationMilliseconds = x.DurationMilliseconds,
                ErrorCode = x.ErrorCode,
                ErrorMessage = x.ErrorMessage,
                StartedAt = x.StartedAt,
                CompletedAt = x.CompletedAt,
            })
            .ToListAsync();

        var runIds = runs.Select(x => x.Id).ToList();
        var executions = await dbContext.AIToolExecutions
            .AsNoTracking()
            .Where(x => runIds.Contains(x.AIRunId))
            .OrderBy(x => x.StartedAt)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.AIRunId,
                Execution = new AIAdminToolExecutionModel
                {
                    Id = x.Id,
                    ToolName = x.ToolName,
                    Status = x.Status,
                    DurationMilliseconds = x.DurationMilliseconds,
                    ErrorCode = x.ErrorCode,
                    ErrorMessage = x.ErrorMessage,
                    StartedAt = x.StartedAt,
                },
            })
            .ToListAsync();

        var emails = await GetEmailsAsync(runs.Select(x => x.UserId));

        foreach (var run in runs)
        {
            run.UserEmail = emails.GetValueOrDefault(run.UserId);
            run.ToolExecutions = executions
                .Where(x => x.AIRunId == run.Id)
                .Select(x => x.Execution)
                .ToList();
        }

        return runs;
    }

    private async Task<Dictionary<long, string?>> GetEmailsAsync(IEnumerable<long> userIds)
    {
        var ids = userIds.Distinct().ToList();

        return await dbContext.Users
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.Email })
            .ToDictionaryAsync(x => x.Id, x => x.Email);
    }

    private static int Percentile(IReadOnlyList<int> sortedValues, double percentile)
    {
        if (sortedValues.Count == 0)
        {
            return 0;
        }

        var index = (int)Math.Ceiling(percentile * sortedValues.Count) - 1;
        return sortedValues[Math.Clamp(index, 0, sortedValues.Count - 1)];
    }
}
