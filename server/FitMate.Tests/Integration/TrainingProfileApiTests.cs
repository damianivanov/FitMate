using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Integration;

public class TrainingProfileApiTests
{
    // Без логин връща 401
    [Fact]
    public async Task Get_WithoutAuth_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/training-profile");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // PUT записва, GET връща същите стойности
    [Fact]
    public async Task PutThenGet_RoundtripsProfile()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("profile-user@test.local");

        var putResponse = await client.PutAsJsonAsync("/api/training-profile", new
        {
            goal = 2,                       // TrainingGoal.Hypertrophy
            experienceLevel = 2,            // Intermediate
            preferredTrainingDaysPerWeek = 4,
            preferredWorkoutDurationMinutes = 60,
            weightUnit = 1,                 // Kg
            availableEquipment = new[] { "Barbell", "Dumbbell" },
            preferredTrainingDays = new[] { 1, 4 },   // Monday, Thursday
            exerciseRestrictions = "No overhead pressing",
            allowAiPersonalization = true,
        });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await client.GetAsync("/api/training-profile");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        using var json = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        Assert.Equal(2, data.GetProperty("goal").GetInt32());
        Assert.Equal(4, data.GetProperty("preferredTrainingDaysPerWeek").GetInt32());
        Assert.Equal(2, data.GetProperty("availableEquipment").GetArrayLength());
        Assert.Equal("No overhead pressing", data.GetProperty("exerciseRestrictions").GetString());
    }

    // Преди първи запис GET връща успех с null данни (а не грешка)
    [Fact]
    public async Task Get_BeforeFirstSave_ReturnsNullData()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("profile-empty@test.local");

        var response = await client.GetAsync("/api/training-profile");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("data").ValueKind);
    }
}
