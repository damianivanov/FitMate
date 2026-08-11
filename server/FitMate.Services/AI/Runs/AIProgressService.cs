using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Runs;

public class AIProgressService : IAIProgressService
{
    private readonly AppDbContext dbContext;

    public AIProgressService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task PublishAsync(
        long runId,
        string code,
        string? toolName = null,
        CancellationToken cancellationToken = default)
    {
        dbContext.AIProgressEvents.Add(new AIProgressEvent
        {
            AIRunId = runId,
            Code = code,
            ToolName = toolName,
        });

        // A terminal event must land even when the run was cancelled, otherwise every observer
        // waits forever on a stream that will never close.
        await dbContext.SaveChangesAsync(
            AIProgressCodes.IsTerminal(code) ? CancellationToken.None : cancellationToken);
    }

    public async Task<IReadOnlyList<AIProgressEventModel>> GetEventsAsync(
        long runId,
        long afterEventId,
        CancellationToken cancellationToken = default) =>
        await dbContext.AIProgressEvents
            .AsNoTracking()
            .Where(x => x.AIRunId == runId && x.Id > afterEventId)
            .OrderBy(x => x.Id)
            .Select(x => new AIProgressEventModel
            {
                Id = x.Id,
                Code = x.Code,
                ToolName = x.ToolName,
                OccurredAt = x.DateCreated,
            })
            .ToListAsync(cancellationToken);
}
