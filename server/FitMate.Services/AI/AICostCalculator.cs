using FitMate.DB;
using FitMate.Integrations.AI.Models;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI;

public class AICostCalculator : IAICostCalculator
{
    private const decimal TokensPerMillion = 1_000_000m;

    private readonly AppDbContext dbContext;

    public AICostCalculator(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<decimal?> EstimateAsync(
        string provider,
        string model,
        AIProviderUsage usage,
        DateTime occurredAt)
    {
        var pricing = await dbContext.AIModelPricings
            .AsNoTracking()
            .Where(x => x.Provider == provider
                && x.Model == model
                && x.EffectiveFrom <= occurredAt
                && (x.EffectiveTo == null || x.EffectiveTo > occurredAt))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (pricing == null)
        {
            return null;
        }

        var cost =
            (usage.InputTokens / TokensPerMillion * pricing.InputCostPerMillionTokens)
            + (usage.CachedInputTokens / TokensPerMillion * pricing.CachedInputCostPerMillionTokens)
            + (usage.OutputTokens / TokensPerMillion * pricing.OutputCostPerMillionTokens);

        return Math.Round(cost, 6);
    }
}
