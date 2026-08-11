using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Runs;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai/runs")]
public class AIRunController : BaseApiController
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(750);

    private readonly IAIRunSnapshotService snapshotService;
    private readonly IAIProgressService progressService;

    public AIRunController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIRunSnapshotService snapshotService,
        IAIProgressService progressService)
        : base(logger, dbContext, userService)
    {
        this.snapshotService = snapshotService;
        this.progressService = progressService;
    }

    [HttpGet("{runId:long}")]
    public async Task<ActionResult> GetSnapshot(long runId, [FromQuery] long afterEventId = 0)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var snapshot = await snapshotService.GetAsync(runId, userId.Value, afterEventId);

        return snapshot == null ? NotFound() : this.ReturnJson(snapshot);
    }

    /// <summary>
    /// Observer stream. RequestAborted ends this stream only: the run belongs to the worker and must
    /// never be cancelled because a browser tab closed.
    /// </summary>
    [HttpGet("{runId:long}/events")]
    public async Task StreamEvents(long runId, [FromQuery] long afterEventId = 0)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var owned = await DbContext.AIRuns
            .AsNoTracking()
            .AnyAsync(x => x.Id == runId && x.UserId == userId.Value);

        if (!owned)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var cursor = ResolveCursor(afterEventId);
        var lastHeartbeat = DateTime.UtcNow;
        var streamToken = HttpContext.RequestAborted;

        try
        {
            while (!streamToken.IsCancellationRequested)
            {
                var events = await progressService.GetEventsAsync(runId, cursor, streamToken);

                foreach (var progressEvent in events)
                {
                    cursor = progressEvent.Id;

                    await Response.WriteAsync(
                        $"id: {progressEvent.Id}\nevent: progress\ndata: {AIJsonSerializer.Serialize(progressEvent)}\n\n",
                        streamToken);
                    await Response.Body.FlushAsync(streamToken);

                    if (AIProgressCodes.IsTerminal(progressEvent.Code))
                    {
                        return;
                    }
                }

                if (DateTime.UtcNow - lastHeartbeat > HeartbeatInterval)
                {
                    lastHeartbeat = DateTime.UtcNow;
                    await Response.WriteAsync(": heartbeat\n\n", streamToken);
                    await Response.Body.FlushAsync(streamToken);
                }

                // A run that reached a terminal state before this observer connected would
                // otherwise hold the connection open forever.
                if (events.Count == 0 && !await IsInFlightAsync(runId, streamToken))
                {
                    return;
                }

                await Task.Delay(PollInterval, streamToken);
            }
        }
        catch (OperationCanceledException)
        {
            // The client went away. Nothing to clean up: the run is not ours to cancel.
        }
    }

    private async Task<bool> IsInFlightAsync(long runId, CancellationToken cancellationToken) =>
        await DbContext.AIRuns
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == runId && (x.Status == AIRunStatus.Queued || x.Status == AIRunStatus.Running),
                cancellationToken);

    /// <summary>The browser resends its cursor as Last-Event-ID on an automatic reconnect.</summary>
    private long ResolveCursor(long afterEventId)
    {
        if (Request.Headers.TryGetValue("Last-Event-ID", out var header)
            && long.TryParse(header.ToString(), out var fromHeader))
        {
            return fromHeader;
        }

        return afterEventId;
    }
}
