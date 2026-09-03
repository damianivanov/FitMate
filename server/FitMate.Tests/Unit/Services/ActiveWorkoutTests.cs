using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

/// <summary>
/// "In progress" means started and not yet finished. A workout that exists but was never started is
/// a draft — the AI creates those on confirmation, and reporting one as a running session would put
/// an "add to your current workout" prompt in front of a user who is not training.
/// </summary>
public class ActiveWorkoutTests
{
    private static WorkoutService CreateService(AppDbContext context) =>
        new(context, new FakePhotoUrlResolver(), new FakeEntitlementService());

    private static async Task AddWorkoutAsync(
        SqliteTestDatabase db,
        string title,
        DateTime? startedAt,
        DateTime? finishedAt = null,
        long userId = SqliteTestDatabase.UserId)
    {
        await using var context = db.CreateContext();
        context.Workouts.Add(new Workout
        {
            UserId = userId,
            Title = title,
            StartedAt = startedAt,
            FinishedAt = finishedAt,
        });
        await context.SaveChangesAsync();
    }

    // Започната и незавършена тренировка се връща
    [Fact]
    public async Task GetActiveAsync_StartedAndUnfinished_IsReturned()
    {
        using var db = new SqliteTestDatabase();
        await AddWorkoutAsync(db, "Back & Biceps", DateTime.UtcNow.AddMinutes(-30));

        await using var context = db.CreateContext();
        var active = await CreateService(context).GetActiveAsync(SqliteTestDatabase.UserId);

        Assert.NotNull(active);
        Assert.Equal("Back & Biceps", active.Title);
    }

    // Незапочната чернова не е текуща сесия
    [Fact]
    public async Task GetActiveAsync_NeverStarted_IsNotASession()
    {
        using var db = new SqliteTestDatabase();
        await AddWorkoutAsync(db, "AI workout", startedAt: null);

        await using var context = db.CreateContext();
        Assert.Null(await CreateService(context).GetActiveAsync(SqliteTestDatabase.UserId));
    }

    // Приключена тренировка не е текуща сесия
    [Fact]
    public async Task GetActiveAsync_Finished_IsNotASession()
    {
        using var db = new SqliteTestDatabase();
        await AddWorkoutAsync(
            db, "Legs", DateTime.UtcNow.AddHours(-2), finishedAt: DateTime.UtcNow.AddHours(-1));

        await using var context = db.CreateContext();
        Assert.Null(await CreateService(context).GetActiveAsync(SqliteTestDatabase.UserId));
    }

    // Изоставена вчерашна сесия не засенчва днешната
    [Fact]
    public async Task GetActiveAsync_SeveralUnfinished_ReturnsTheNewest()
    {
        using var db = new SqliteTestDatabase();
        await AddWorkoutAsync(db, "Yesterday", DateTime.UtcNow.AddDays(-1));
        await AddWorkoutAsync(db, "Today", DateTime.UtcNow.AddMinutes(-10));

        await using var context = db.CreateContext();
        var active = await CreateService(context).GetActiveAsync(SqliteTestDatabase.UserId);

        Assert.NotNull(active);
        Assert.Equal("Today", active.Title);
    }

    // Чужда сесия не се вижда
    [Fact]
    public async Task GetActiveAsync_SessionOfAnotherUser_IsNotReturned()
    {
        using var db = new SqliteTestDatabase();
        await AddWorkoutAsync(
            db, "Theirs", DateTime.UtcNow.AddMinutes(-5), userId: SqliteTestDatabase.OtherUserId);

        await using var context = db.CreateContext();
        Assert.Null(await CreateService(context).GetActiveAsync(SqliteTestDatabase.UserId));
    }
}
