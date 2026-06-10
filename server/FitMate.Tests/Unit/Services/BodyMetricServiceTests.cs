using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.BodyMetrics;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.BodyMetrics;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class BodyMetricServiceTests
{
    private static long SeedMetric(
        AppDbContext db,
        long userId,
        decimal weightKg,
        DateTime dateCreated,
        decimal? bodyFat = null,
        string? notes = null)
    {
        var entry = new UserBodyMetric
        {
            UserId = userId,
            BodyWeightKg = weightKg,
            BodyFatPercentage = bodyFat,
            Notes = notes,
            DateCreated = dateCreated,
        };

        db.UserBodyMetrics.Add(entry);
        db.SaveChanges();
        return entry.Id;
    }

    [Fact]
    public async Task LogAsync_InvalidUserId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new BodyMetricService(db.CreateContext());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.LogAsync(new LogBodyMetricRequest { BodyWeightKg = 80m }, 0));

        Assert.Equal("Unauthorized.", ex.Message);
    }

    [Fact]
    public async Task LogAsync_PersistsEntryForUser()
    {
        using var db = new SqliteTestDatabase();
        var service = new BodyMetricService(db.CreateContext());

        var result = await service.LogAsync(
            new LogBodyMetricRequest { BodyWeightKg = 82.5m, BodyFatPercentage = 18m, Notes = "Morning" },
            SqliteTestDatabase.UserId);

        Assert.True(result.Id > 0);
        Assert.Equal(82.5m, result.BodyWeightKg);
        Assert.Equal(18m, result.BodyFatPercentage);
        Assert.Equal("Morning", result.Notes);
        Assert.NotEqual(default, result.LoggedAt);

        var entries = await new BodyMetricService(db.CreateContext())
            .ListAsync(SqliteTestDatabase.UserId);

        Assert.Single(entries);
        Assert.Equal(82.5m, entries[0].BodyWeightKg);
    }

    [Fact]
    public async Task LogAsync_BlankNotes_StoredAsNull()
    {
        using var db = new SqliteTestDatabase();
        var service = new BodyMetricService(db.CreateContext());

        var result = await service.LogAsync(
            new LogBodyMetricRequest { BodyWeightKg = 75m, Notes = "   " },
            SqliteTestDatabase.UserId);

        Assert.Null(result.Notes);
    }

    [Fact]
    public async Task ListAsync_ReturnsOnlyOwnEntriesNewestFirst()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            SeedMetric(arrange, SqliteTestDatabase.UserId, 80m, new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc));
            SeedMetric(arrange, SqliteTestDatabase.UserId, 81m, new DateTime(2026, 3, 5, 8, 0, 0, DateTimeKind.Utc));
            SeedMetric(arrange, SqliteTestDatabase.OtherUserId, 99m, new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc));
        }

        var entries = await new BodyMetricService(db.CreateContext())
            .ListAsync(SqliteTestDatabase.UserId);

        Assert.Equal(2, entries.Count);
        Assert.Equal(81m, entries[0].BodyWeightKg);
        Assert.Equal(80m, entries[1].BodyWeightKg);
    }

    [Fact]
    public async Task DeleteAsync_RemovesOwnEntry()
    {
        using var db = new SqliteTestDatabase();
        long entryId;

        using (var arrange = db.CreateContext())
        {
            entryId = SeedMetric(arrange, SqliteTestDatabase.UserId, 80m, new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc));
        }

        var deleted = await new BodyMetricService(db.CreateContext())
            .DeleteAsync(entryId, SqliteTestDatabase.UserId);

        Assert.True(deleted);

        var entries = await new BodyMetricService(db.CreateContext())
            .ListAsync(SqliteTestDatabase.UserId);

        Assert.Empty(entries);
    }

    [Fact]
    public async Task DeleteAsync_OtherUsersEntry_Throws()
    {
        using var db = new SqliteTestDatabase();
        long entryId;

        using (var arrange = db.CreateContext())
        {
            entryId = SeedMetric(arrange, SqliteTestDatabase.OtherUserId, 99m, new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc));
        }

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => new BodyMetricService(db.CreateContext()).DeleteAsync(entryId, SqliteTestDatabase.UserId));

        Assert.Equal("Entry not found.", ex.Message);

        var stillThere = await new BodyMetricService(db.CreateContext())
            .ListAsync(SqliteTestDatabase.OtherUserId);

        Assert.Single(stillThere);
    }
}
