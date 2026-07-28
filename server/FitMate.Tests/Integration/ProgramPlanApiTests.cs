using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ProgramPlanApiTests
{
    private static async Task<long> SeedTemplateForUserAsync(TestWebApplicationFactory factory, string email)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await context.Users
            .Where(u => u.Email == email)
            .Select(u => u.Id)
            .SingleAsync();
        var template = new WorkoutTemplate { UserId = userId, Name = "Upper A", IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest ValidRequest(long templateId) => new()
    {
        Name = "Integration plan",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
        EndDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(28),
        TargetWorkoutsPerWeek = 1,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest
            {
                DayOfWeek = DateTime.UtcNow.DayOfWeek,
                DayType = ProgramPlanDayType.Workout,
                WorkoutTemplateId = templateId,
                WeekInterval = 1,
                OrderIndex = 0,
            },
        ],
    };

    [Fact]
    public async Task ProgramPlanEndpoints_WithoutAuth_Return401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/program-plans");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateActivateAndGetToday_ReturnsActiveProgram()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plan-owner@test.local");
        var templateId = await SeedTemplateForUserAsync(factory, "plan-owner@test.local");

        var createResponse = await client.PostAsJsonAsync("/api/program-plans", ValidRequest(templateId));
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();
        Assert.True(created!.Success);

        var activateResponse = await client.PostAsync($"/api/program-plans/{created.Data!.Id}/activate", null);
        activateResponse.EnsureSuccessStatusCode();

        var todayResponse = await client.GetAsync("/api/program-plans/active/today");
        var today = await todayResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramTodayModel>>();
        Assert.True(today!.Success);
        Assert.True(today.Data!.HasActiveProgram);
        Assert.Equal(created.Data.Id, today.Data.ProgramId);
        Assert.NotNull(today.Data.Today);
    }

    [Fact]
    public async Task StartDay_IsIdempotentOverHttp()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plan-starter@test.local");
        var templateId = await SeedTemplateForUserAsync(factory, "plan-starter@test.local");

        var createResponse = await client.PostAsJsonAsync("/api/program-plans", ValidRequest(templateId));
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();
        await client.PostAsync($"/api/program-plans/{created!.Data!.Id}/activate", null);

        var todayResponse = await client.GetAsync("/api/program-plans/active/today");
        var today = await todayResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramTodayModel>>();
        var dayId = today!.Data!.Today!.Id;

        var firstStart = await client.PostAsync($"/api/program-plan-days/{dayId}/start", null);
        var first = await firstStart.Content.ReadFromJsonAsync<ApiResponse<long>>();
        var secondStart = await client.PostAsync($"/api/program-plan-days/{dayId}/start", null);
        var second = await secondStart.Content.ReadFromJsonAsync<ApiResponse<long>>();

        Assert.True(first!.Success);
        Assert.True(second!.Success);
        Assert.Equal(first.Data, second.Data);
    }

    [Fact]
    public async Task GetById_OtherUsersPlan_ReturnsErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory();
        var ownerClient = await factory.CreateUserClientAsync("plan-owner-b@test.local");
        var templateId = await SeedTemplateForUserAsync(factory, "plan-owner-b@test.local");
        var createResponse = await ownerClient.PostAsJsonAsync("/api/program-plans", ValidRequest(templateId));
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();

        var strangerClient = await factory.CreateUserClientAsync("stranger@test.local");
        var response = await strangerClient.GetAsync($"/api/program-plans/{created!.Data!.Id}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();

        Assert.False(body!.Success);
    }
}
