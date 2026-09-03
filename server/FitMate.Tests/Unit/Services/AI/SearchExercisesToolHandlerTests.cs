using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Tools;
using FitMate.Services.AI.Tools.ReadOnly;
using FitMate.Services.Exercises;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

namespace FitMate.Tests.Unit.Services.AI;

/// <summary>
/// The AI loop runs in a background worker, so these tests deliberately build the handler with a
/// user service that has no logged-in user — the exact condition the worker runs under.
/// </summary>
public class SearchExercisesToolHandlerTests
{
    private static SearchExercisesToolHandler BuildHandler(AppDbContext context)
    {
        var exerciseService = new ExerciseService(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            new FakeUserService { LoggedInUserId = null },
            new FakeBlobStorageService(),
            new FakeImageProcessor(),
            new FakePhotoUrlResolver());

        return new SearchExercisesToolHandler(exerciseService);
    }

    private static AIToolContext ContextFor(long userId) => new()
    {
        UserId = userId,
        ConversationId = 1,
        AIRunId = 1,
    };

    private static async Task SeedAsync(AppDbContext context, long userId)
    {
        var service = new ExerciseService(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            FakeUserService.ForUser(userId),
            new FakeBlobStorageService(),
            new FakeImageProcessor(),
            new FakePhotoUrlResolver());

        await service.CreatePersonalAsync(new CreateExerciseRequest
        {
            Name = "Standing Cable Row",
            PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
            IsPublic = false,
        });
    }

    /// <summary>Serialized the way the orchestrator does, so the assertions match what the model reads.</summary>
    private static List<JsonElement> ReadGroups(object? data)
    {
        var document = JsonDocument.Parse(AIJsonSerializer.Serialize(data));
        return [.. document.RootElement.GetProperty("results").EnumerateArray()];
    }

    // Без HttpContext (както е в worker-а) търсенето трябва да успее чрез context.UserId
    [Fact]
    public async Task ExecuteAsync_NoRequestPrincipal_SearchesAsTheContextUser()
    {
        using var db = new SqliteTestDatabase();

        using (var seed = db.CreateContext())
        {
            await SeedAsync(seed, SqliteTestDatabase.UserId);
        }

        using var context = db.CreateContext();
        var handler = BuildHandler(context);

        var result = await handler.ExecuteAsync(
            """{"search":"cable row"}""",
            ContextFor(SqliteTestDatabase.UserId),
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Null(result.ErrorCode);

        var groups = ReadGroups(result.Data);
        var exercises = groups.Single().GetProperty("exercises");
        Assert.Equal("Standing Cable Row", exercises.EnumerateArray().Single().GetProperty("name").GetString());
    }

    // Търсенето не изтича частни упражнения на друг потребител
    [Fact]
    public async Task ExecuteAsync_PrivateExerciseOfAnotherUser_IsNotReturned()
    {
        using var db = new SqliteTestDatabase();

        using (var seed = db.CreateContext())
        {
            await SeedAsync(seed, SqliteTestDatabase.OtherUserId);
        }

        using var context = db.CreateContext();
        var handler = BuildHandler(context);

        var result = await handler.ExecuteAsync(
            """{"search":"cable row"}""",
            ContextFor(SqliteTestDatabase.UserId),
            CancellationToken.None);

        Assert.True(result.Success);

        var groups = ReadGroups(result.Data);
        Assert.Equal(0, groups.Single().GetProperty("count").GetInt32());
    }

    // Няколко термина в едно извикване връщат по една група на термин
    [Fact]
    public async Task ExecuteAsync_BatchedSearches_ReturnsOneGroupPerTerm()
    {
        using var db = new SqliteTestDatabase();

        using (var seed = db.CreateContext())
        {
            await SeedAsync(seed, SqliteTestDatabase.UserId);
        }

        using var context = db.CreateContext();
        var handler = BuildHandler(context);

        var result = await handler.ExecuteAsync(
            """{"searches":["cable row","nothing matches this"]}""",
            ContextFor(SqliteTestDatabase.UserId),
            CancellationToken.None);

        Assert.True(result.Success);

        var groups = ReadGroups(result.Data);
        Assert.Equal(2, groups.Count);
        Assert.Equal(1, groups[0].GetProperty("count").GetInt32());
        Assert.Equal(0, groups[1].GetProperty("count").GetInt32());
    }
}
