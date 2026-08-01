using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI;

public class AISettingsService : IAISettingsService
{
    public const int DefaultMaximumContextTokens = 32_000;
    public const int DefaultMaximumOutputTokens = 4_000;
    public const int DefaultMaximumMessageCharacters = 16_000;

    private const string CacheKey = "ai:settings";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    private readonly AppDbContext dbContext;
    private readonly IMemoryCache cache;
    private readonly AIOptions options;

    public AISettingsService(AppDbContext dbContext, IMemoryCache cache, IOptions<AIOptions> options)
    {
        this.dbContext = dbContext;
        this.cache = cache;
        this.options = options.Value;
    }

    public void Invalidate() => cache.Remove(CacheKey);

    public async Task<AISettingsModel> GetAsync()
    {
        if (cache.TryGetValue(CacheKey, out AISettingsModel? cached) && cached != null)
        {
            return cached;
        }

        var stored = await dbContext.AISettings.AsNoTracking().FirstOrDefaultAsync();
        var model = stored == null ? FromOptions() : FromEntity(stored);

        cache.Set(CacheKey, model, CacheDuration);
        return model;
    }

    public async Task<AISettingsModel> SaveAsync(SaveAISettingsRequest request)
    {
        Validate(request);

        var entity = await dbContext.AISettings.FirstOrDefaultAsync();
        if (entity == null)
        {
            entity = new AISettings();
            dbContext.AISettings.Add(entity);
        }

        entity.DefaultModel = request.DefaultModel.Trim();
        entity.FastModel = request.FastModel.Trim();
        entity.ReasoningModel = request.ReasoningModel.Trim();
        entity.VisionModel = request.VisionModel.Trim();
        entity.ImageModel = request.ImageModel.Trim();
        entity.TimeoutSeconds = request.TimeoutSeconds;
        entity.MaximumToolIterations = request.MaximumToolIterations;
        entity.MaximumToolCallsPerRun = request.MaximumToolCallsPerRun;
        entity.MaximumConversationMessages = request.MaximumConversationMessages;
        entity.MaximumContextTokens = request.MaximumContextTokens;
        entity.MaximumOutputTokens = request.MaximumOutputTokens;
        entity.MaximumMessageCharacters = request.MaximumMessageCharacters;
        entity.StoreRawProviderPayload = request.StoreRawProviderPayload;

        await dbContext.SaveChangesAsync();
        Invalidate();

        return FromEntity(entity);
    }

    private static void Validate(SaveAISettingsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DefaultModel))
        {
            throw new FitMateException("A default model is required.");
        }

        RequirePositive(request.TimeoutSeconds, "The timeout");
        RequirePositive(request.MaximumToolIterations, "The tool iteration limit");
        RequirePositive(request.MaximumToolCallsPerRun, "The tool call limit");
        RequirePositive(request.MaximumConversationMessages, "The conversation message limit");
        RequirePositive(request.MaximumContextTokens, "The context token limit");
        RequirePositive(request.MaximumOutputTokens, "The output token limit");
        RequirePositive(request.MaximumMessageCharacters, "The message length limit");
    }

    private static void RequirePositive(int value, string label)
    {
        if (value <= 0)
        {
            throw new FitMateException($"{label} must be greater than zero.");
        }
    }

    private AISettingsModel FromOptions() => new()
    {
        Provider = options.Provider,
        DefaultModel = options.DefaultModel,
        FastModel = options.FastModel,
        ReasoningModel = options.ReasoningModel,
        VisionModel = options.VisionModel,
        ImageModel = options.ImageModel,
        TimeoutSeconds = options.TimeoutSeconds,
        MaximumToolIterations = options.MaximumToolIterations,
        MaximumToolCallsPerRun = options.MaximumToolCallsPerRun,
        MaximumConversationMessages = options.MaximumConversationMessages,
        MaximumContextTokens = DefaultMaximumContextTokens,
        MaximumOutputTokens = DefaultMaximumOutputTokens,
        MaximumMessageCharacters = DefaultMaximumMessageCharacters,
        StoreRawProviderPayload = options.StoreRawProviderPayload,
        IsStored = false,
    };

    private AISettingsModel FromEntity(AISettings entity) => new()
    {
        Provider = options.Provider,
        DefaultModel = entity.DefaultModel,
        FastModel = entity.FastModel,
        ReasoningModel = entity.ReasoningModel,
        VisionModel = entity.VisionModel,
        ImageModel = entity.ImageModel,
        TimeoutSeconds = entity.TimeoutSeconds,
        MaximumToolIterations = entity.MaximumToolIterations,
        MaximumToolCallsPerRun = entity.MaximumToolCallsPerRun,
        MaximumConversationMessages = entity.MaximumConversationMessages,
        MaximumContextTokens = entity.MaximumContextTokens,
        MaximumOutputTokens = entity.MaximumOutputTokens,
        MaximumMessageCharacters = entity.MaximumMessageCharacters,
        StoreRawProviderPayload = entity.StoreRawProviderPayload,
        IsStored = true,
    };
}
