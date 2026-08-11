using FitMate.Services.AI.Context;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AITrainingContextQueryTests
{
    // Ограничението се прилага в SQL, най-новите първи
    [Fact]
    public async Task GetRecentWorkouts_RespectsTake_AndReturnsNewestFirst()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddWorkoutsAsync(context, SqliteTestDatabase.UserId, count: 30);

        var result = await new AITrainingContextQuery(context)
            .GetRecentWorkoutsAsync(SqliteTestDatabase.UserId, 10, CancellationToken.None);

        Assert.Equal(10, result.Count);
        Assert.True(result[0].StartedAt >= result[^1].StartedAt);
    }

    // Заявеното над твърдия таван се орязва
    [Fact]
    public async Task GetRecentWorkouts_ClampsTakeToHardMaximum()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddWorkoutsAsync(context, SqliteTestDatabase.UserId, count: 40);

        var result = await new AITrainingContextQuery(context)
            .GetRecentWorkoutsAsync(SqliteTestDatabase.UserId, 10_000, CancellationToken.None);

        Assert.True(result.Count <= 20);
    }

    // Чуждите тренировки не се виждат
    [Fact]
    public async Task GetRecentWorkouts_ExcludesOtherUsers()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddWorkoutsAsync(context, SqliteTestDatabase.OtherUserId, count: 5);

        var result = await new AITrainingContextQuery(context)
            .GetRecentWorkoutsAsync(SqliteTestDatabase.UserId, 10, CancellationToken.None);

        Assert.Empty(result);
    }

    // Кандидатите се ограничават и не носят медийни адреси
    [Fact]
    public async Task GetExerciseCandidates_CapsResults_AndOmitsMediaUrls()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddExercisesAsync(context, count: 100, muscleGroupId: SqliteTestDatabase.ChestId);

        var result = await new AITrainingContextQuery(context).GetExerciseCandidatesAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 12, CancellationToken.None);

        Assert.Equal(12, result.Count);
        Assert.All(result, x => Assert.False(string.IsNullOrWhiteSpace(x.Name)));

        // The projection has no place to put a URL, which is the point: the model never sees media.
        var serialized = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("example.test", serialized);
    }

    // Таванът за кандидати е твърд
    [Fact]
    public async Task GetExerciseCandidates_ClampsRequestedTakeToHardMaximum()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddExercisesAsync(context, count: 300, muscleGroupId: SqliteTestDatabase.ChestId);

        var result = await new AITrainingContextQuery(context).GetExerciseCandidatesAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 10_000, CancellationToken.None);

        Assert.True(result.Count <= 100);
    }

    // Само последната сесия на упражнение
    [Fact]
    public async Task GetLatestPerformance_ReturnsOnlyTheMostRecentSessionPerExercise()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var exerciseId = await WorkoutSeed.AddExerciseWithHistoryAsync(
            context, SqliteTestDatabase.UserId, sessions: 5);

        var result = await new AITrainingContextQuery(context).GetLatestPerformanceAsync(
            SqliteTestDatabase.UserId, [exerciseId], CancellationToken.None);

        var performance = Assert.Single(result).Value;

        // Five sessions seeded at 60/8, 61/9 ... so the newest is the fifth.
        Assert.Equal(64, performance.WeightKg);
        Assert.Equal([12], performance.Reps);
    }

    // Празен списък не удря базата
    [Fact]
    public async Task GetLatestPerformance_WithEmptyIds_ReturnsEmpty()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var result = await new AITrainingContextQuery(context).GetLatestPerformanceAsync(
            SqliteTestDatabase.UserId, [], CancellationToken.None);

        Assert.Empty(result);
    }

    // Чуждата история не изтича
    [Fact]
    public async Task GetLatestPerformance_ExcludesOtherUsersSessions()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var exerciseId = await WorkoutSeed.AddExerciseWithHistoryAsync(
            context, SqliteTestDatabase.OtherUserId, sessions: 3);

        var result = await new AITrainingContextQuery(context).GetLatestPerformanceAsync(
            SqliteTestDatabase.UserId, [exerciseId], CancellationToken.None);

        Assert.Empty(result);
    }

    // Шаблоните се търсят по упражнение и се ограничават
    [Fact]
    public async Task GetMatchingTemplates_ReturnsOnlyTemplatesContainingTheExercise()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var ids = await WorkoutSeed.AddExercisesAsync(context, count: 2, muscleGroupId: SqliteTestDatabase.ChestId);
        await WorkoutSeed.AddTemplateAsync(context, SqliteTestDatabase.UserId, ids[0], "Matching");
        await WorkoutSeed.AddTemplateAsync(context, SqliteTestDatabase.UserId, ids[1], "Unrelated");

        var result = await new AITrainingContextQuery(context).GetMatchingTemplatesAsync(
            SqliteTestDatabase.UserId, [ids[0]], 10, CancellationToken.None);

        var template = Assert.Single(result);
        Assert.Equal("Matching", template.Name);
        Assert.Equal(1, template.ExerciseCount);
    }

    // Празен списък от упражнения не връща шаблони
    [Fact]
    public async Task GetMatchingTemplates_WithEmptyIds_ReturnsEmpty()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var result = await new AITrainingContextQuery(context).GetMatchingTemplatesAsync(
            SqliteTestDatabase.UserId, [], 10, CancellationToken.None);

        Assert.Empty(result);
    }

    // Последно натоварване по мускулна група
    [Fact]
    public async Task GetRecentMuscleExposure_ReportsLatestSessionPerMuscleGroup()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddExerciseWithHistoryAsync(context, SqliteTestDatabase.UserId, sessions: 4);

        var result = await new AITrainingContextQuery(context).GetRecentMuscleExposureAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 12, CancellationToken.None);

        var exposure = Assert.Single(result);
        Assert.Equal(SqliteTestDatabase.ChestId, exposure.MuscleGroupId);
        Assert.Equal(new DateTime(2026, 1, 4, 8, 0, 0, DateTimeKind.Utc), exposure.LastTrainedAt);
    }

    // Без тренировки няма експозиция
    [Fact]
    public async Task GetRecentMuscleExposure_WithNoWorkouts_ReturnsEmpty()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var result = await new AITrainingContextQuery(context).GetRecentMuscleExposureAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 12, CancellationToken.None);

        Assert.Empty(result);
    }
}
