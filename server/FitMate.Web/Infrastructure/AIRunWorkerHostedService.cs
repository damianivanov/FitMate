using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using Microsoft.Extensions.Options;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// Owns run execution independently of any HTTP request. Each claimed run gets its own scope, and
/// therefore its own AppDbContext, so a request that has already ended cannot affect it.
/// </summary>
public class AIRunWorkerHostedService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<AIRunWorkerHostedService> logger;
    private readonly AIRunOptions options;
    private readonly string workerId;

    public AIRunWorkerHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<AIRunWorkerHostedService> logger,
        IOptions<AIRunOptions> options)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
        this.options = options.Value;

        var candidate = $"{Environment.MachineName}-{Guid.NewGuid():N}";
        workerId = candidate.Length <= 100 ? candidate : candidate[^100..];
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.WorkerEnabled)
        {
            logger.LogInformation("AI run worker is disabled by configuration.");
            return;
        }

        logger.LogInformation("AI run worker {WorkerId} started.", workerId);

        var lastReclaim = DateTime.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - lastReclaim > TimeSpan.FromSeconds(options.LeaseSeconds))
                {
                    lastReclaim = DateTime.UtcNow;
                    await ReclaimStaleAsync(stoppingToken);
                }

                if (!await ClaimAndProcessOneAsync(stoppingToken))
                {
                    await Task.Delay(options.PollIntervalMilliseconds, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "AI run worker loop iteration failed.");

                try
                {
                    await Task.Delay(options.PollIntervalMilliseconds, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        logger.LogInformation("AI run worker {WorkerId} stopped.", workerId);
    }

    private async Task<bool> ClaimAndProcessOneAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<IAIRunQueue>();

        var runId = await queue.ClaimNextAsync(workerId, DateTime.UtcNow, stoppingToken);
        if (runId == null)
        {
            return false;
        }

        var orchestrator = scope.ServiceProvider.GetRequiredService<IAIOrchestrator>();

        try
        {
            await orchestrator.ProcessAsync(runId.Value, workerId, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Shutdown mid-run. The orchestrator only lets this escape when nothing was executed
            // yet, so handing the run back to the queue cannot duplicate work.
            await queue.RequeueSafeAsync(runId.Value, workerId, DateTime.UtcNow, CancellationToken.None);
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "AI run {RunId} failed in the worker.", runId.Value);
        }

        return true;
    }

    private async Task ReclaimStaleAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<IAIRunQueue>();

        var reclaimed = await queue.ReclaimStaleAsync(DateTime.UtcNow, stoppingToken);
        if (reclaimed > 0)
        {
            logger.LogWarning("Reclaimed {Count} stale AI runs.", reclaimed);
        }
    }
}
