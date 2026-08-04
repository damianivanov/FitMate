using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Integrations.AI.Abstractions;
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
    private const string ModelsCacheKey = "ai:models";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan ModelsCacheDuration = TimeSpan.FromMinutes(30);

    private readonly AppDbContext dbContext;
    private readonly IMemoryCache cache;
    private readonly AIOptions options;
    private readonly IAIModelCatalog modelCatalog;

    public AISettingsService(
        AppDbContext dbContext,
        IMemoryCache cache,
        IOptions<AIOptions> options,
        IAIModelCatalog modelCatalog)
    {
        this.dbContext = dbContext;
        this.cache = cache;
        this.options = options.Value;
        this.modelCatalog = modelCatalog;
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
        entity.ConversationRetentionDays = request.ConversationRetentionDays;
        entity.OperationalLogRetentionDays = request.OperationalLogRetentionDays;
        entity.TemporaryUploadRetentionHours = request.TemporaryUploadRetentionHours;
        entity.ExpiredActionRetentionDays = request.ExpiredActionRetentionDays;

        await dbContext.SaveChangesAsync();
        Invalidate();

        return FromEntity(entity);
    }

    public async Task<IReadOnlyList<string>> ListAvailableModelsAsync()
    {
        if (cache.TryGetValue(ModelsCacheKey, out IReadOnlyList<string>? cached) && cached != null)
        {
            return cached;
        }

        IReadOnlyList<string> models;
        try
        {
            models = await modelCatalog.ListModelsAsync();
        }
        catch (Exception)
        {
            // An unconfigured key or an unreachable provider must not break the settings page.
            return [];
        }

        cache.Set(ModelsCacheKey, models, ModelsCacheDuration);
        return models;
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
        RequirePositive(request.ConversationRetentionDays, "The conversation retention window");
        RequirePositive(request.OperationalLogRetentionDays, "The operational log retention window");
        RequirePositive(request.TemporaryUploadRetentionHours, "The temporary upload retention window");
        RequirePositive(request.ExpiredActionRetentionDays, "The expired action retention window");
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
        ConversationRetentionDays = options.Retention.ConversationRetentionDays,
        OperationalLogRetentionDays = options.Retention.OperationalLogRetentionDays,
        TemporaryUploadRetentionHours = options.Retention.TemporaryUploadRetentionHours,
        ExpiredActionRetentionDays = options.Retention.ExpiredActionRetentionDays,
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
        ConversationRetentionDays = entity.ConversationRetentionDays,
        OperationalLogRetentionDays = entity.OperationalLogRetentionDays,
        TemporaryUploadRetentionHours = entity.TemporaryUploadRetentionHours,
        ExpiredActionRetentionDays = entity.ExpiredActionRetentionDays,
        IsStored = true,
    };
}
