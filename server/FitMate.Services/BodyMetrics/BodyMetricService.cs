using System.Linq.Expressions;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.BodyMetrics;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.BodyMetrics;

public class BodyMetricService : IBodyMetricService
{
    private readonly AppDbContext dbContext;

    public BodyMetricService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<BodyMetricEntryModel>> ListAsync(long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        return await dbContext.UserBodyMetrics
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .Select(MapToModelExpression())
            .ToListAsync();
    }

    public async Task<BodyMetricEntryModel> LogAsync(LogBodyMetricRequest request, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (request.BodyWeightKg <= 0)
        {
            throw new FitMateException("Body weight is required.");
        }

        var entry = new UserBodyMetric
        {
            UserId = userId,
            BodyWeightKg = request.BodyWeightKg,
            BodyFatPercentage = request.BodyFatPercentage,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };

        dbContext.UserBodyMetrics.Add(entry);
        await dbContext.SaveChangesAsync();

        return MapToModel(entry);
    }

    public async Task<bool> DeleteAsync(long id, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var entry = await dbContext.UserBodyMetrics
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);

        if (entry == null)
        {
            throw new FitMateException("Entry not found.");
        }

        dbContext.UserBodyMetrics.Remove(entry);
        await dbContext.SaveChangesAsync();

        return true;
    }

    private static BodyMetricEntryModel MapToModel(UserBodyMetric entity)
    {
        return new BodyMetricEntryModel
        {
            Id = entity.Id,
            BodyWeightKg = entity.BodyWeightKg,
            BodyFatPercentage = entity.BodyFatPercentage,
            Notes = entity.Notes,
            LoggedAt = entity.DateCreated,
        };
    }

    private static Expression<Func<UserBodyMetric, BodyMetricEntryModel>> MapToModelExpression()
    {
        return entity => new BodyMetricEntryModel
        {
            Id = entity.Id,
            BodyWeightKg = entity.BodyWeightKg,
            BodyFatPercentage = entity.BodyFatPercentage,
            Notes = entity.Notes,
            LoggedAt = entity.DateCreated,
        };
    }
}
