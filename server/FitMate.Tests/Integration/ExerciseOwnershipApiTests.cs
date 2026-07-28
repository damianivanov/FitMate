using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ExerciseOwnershipApiTests
{
    private static async Task<long> SeedMuscleGroupAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var muscleGroup = new MuscleGroup { Name = $"Chest-{Guid.NewGuid():N}" };
        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync();
        return muscleGroup.Id;
    }

    private static object NewExercisePayload(long muscleGroupId) => new
    {
        name = $"Exercise {Guid.NewGuid():N}",
        primaryMuscleGroupId = muscleGroupId,
        isPublic = false,
    };

    // Admin създава ГЛОБАЛНО упражнение: без собственик, винаги публично
    [Fact]
    public async Task Create_AsAdmin_CreatesGlobalPublicExercise()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        Assert.Equal(JsonValueKind.Null, data.GetProperty("userId").ValueKind);
        Assert.True(data.GetProperty("isPublic").GetBoolean());
    }

    // Обикновен потребител създава ЛИЧНО упражнение със заявената видимост
    [Fact]
    public async Task Create_AsNormalUser_CreatesPersonalExerciseWithRequestedVisibility()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = await factory.CreateUserClientAsync("owner-nonadmin@test.local");

        var response = await client.PostAsJsonAsync("/api/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        Assert.NotEqual(JsonValueKind.Null, data.GetProperty("userId").ValueKind);
        Assert.False(data.GetProperty("isPublic").GetBoolean());
    }

    // Без логин връща 401
    [Fact]
    public async Task Create_WithoutAuth_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = factory.CreateApiClient();

        var response = await client.PostAsJsonAsync("/api/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
