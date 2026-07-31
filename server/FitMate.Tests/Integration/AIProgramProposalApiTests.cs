using System.Net.Http.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AIProgramProposalApiTests
{
    private sealed record Seed(long UserId, long TemplateId, long ExerciseId);

    private static async Task<Seed> SeedAsync(TestWebApplicationFactory factory, string email)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var userId = await dbContext.Users.Where(x => x.Email == email).Select(x => x.Id).SingleAsync();

        var muscleGroup = new MuscleGroup { Name = $"Legs-{Guid.NewGuid():N}" };
        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync();

        var suffix = Guid.NewGuid().ToString("N");
        var exercise = new Exercise
        {
            Name = $"Back squat-{suffix}",
            Slug = $"back-squat-{suffix}",
            PrimaryMuscleGroupId = muscleGroup.Id,
            IsPublic = true,
        };
        var template = new WorkoutTemplate { UserId = userId, Name = "Upper A", IsPublic = false };
        dbContext.Exercises.Add(exercise);
        dbContext.WorkoutTemplates.Add(template);
        await dbContext.SaveChangesAsync();

        // Program generation is a paid feature; Free would be refused before any proposal is made.
        SqliteTestDatabase.SeedActiveSubscription(dbContext, userId, SqliteTestDatabase.PlusPlanId);

        return new Seed(userId, template.Id, exercise.Id);
    }

    /// <summary>
    /// Runs a scripted model turn that proposes a two-day program: Monday reuses the seeded
    /// template, Thursday needs a brand new one referenced by client key.
    /// </summary>
    private static async Task<(HttpClient Client, AIActionModel Action, Seed Seed)> ProposeProgramAsync(
        TestWebApplicationFactory factory,
        string email)
    {
        var client = await factory.CreateUserClientAsync(email);
        var seed = await SeedAsync(factory, email);

        factory.Services.GetRequiredService<FakeAICompletionProvider>()
            .EnqueueToolCall(
                "call-1",
                "propose_program_plan",
                $$"""
                {
                  "name": "Upper/Lower 2x",
                  "goal": "Hypertrophy",
                  "scheduleType": "FixedWeekdays",
                  "startDate": "2026-01-05",
                  "endDate": "2026-03-02",
                  "workoutsPerWeek": 2,
                  "schedule": [
                    { "dayOfWeek": "Monday", "dayType": "Workout", "existingWorkoutTemplateId": {{seed.TemplateId}} },
                    { "dayOfWeek": "Thursday", "dayType": "Workout", "newWorkoutTemplateClientKey": "lower-a" },
                    { "dayOfWeek": "Sunday", "dayType": "Rest" }
                  ],
                  "newTemplates": [
                    {
                      "clientKey": "lower-a",
                      "name": "Lower A",
                      "exercises": [
                        {
                          "exerciseId": {{seed.ExerciseId}},
                          "sets": [{ "setType": "Working", "reps": 8 }, { "setType": "Working", "reps": 8 }]
                        }
                      ]
                    }
                  ]
                }
                """)
            .EnqueueText("Here is a two-day program to review.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation!.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "Build me an upper/lower program." });
        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<SendAIMessageResponse>>();

        Assert.True(body!.Success);
        var action = Assert.Single(body.Data!.Actions);
        return (client, action, seed);
    }

    // Предложението чака потвърждение и още няма създадена програма
    [Fact]
    public async Task ProposeProgram_ReturnsPendingActionAndCreatesNothing()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, action, _) = await ProposeProgramAsync(factory, "program-propose@test.local");

        Assert.Equal(AIActionStatus.PendingConfirmation, action.Status);
        Assert.Equal(AIActionType.CreateProgramPlan, action.ActionType);
        Assert.Equal("Upper/Lower 2x", action.Preview.Title);

        // Прегледът показва имена на дни и шаблони, не идентификатори
        Assert.Contains(action.Preview.Lines, x => x.Label == "Monday" && x.Value == "Upper A");
        Assert.Contains(action.Preview.Lines, x => x.Label == "Thursday" && x.Value == "Lower A");
        Assert.Contains(action.Preview.Lines, x => x.Label == "Sunday" && x.Value == "Rest");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await dbContext.ProgramPlans.ToListAsync());
    }

    // Потвърждаването създава шаблона и програмата като чернова, не активна
    [Fact]
    public async Task Confirm_CreatesTemplateAndDraftProgram()
    {
        using var factory = new TestWebApplicationFactory();
        var (client, action, seed) = await ProposeProgramAsync(factory, "program-confirm@test.local");

        var response = await client.PostAsync($"/api/ai/actions/{action.Id}/confirm", null);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIActionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(AIActionStatus.Executed, body.Data!.Status);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var plan = await dbContext.ProgramPlans
            .Include(x => x.ScheduleRules)
            .SingleAsync(x => x.UserId == seed.UserId);

        Assert.Equal(ProgramPlanStatus.Draft, plan.Status);
        Assert.Equal(3, plan.ScheduleRules.Count);

        var newTemplate = await dbContext.WorkoutTemplates
            .SingleAsync(x => x.UserId == seed.UserId && x.Name == "Lower A");

        // Понеделник сочи към съществуващия шаблон, четвъртък — към новосъздадения
        Assert.Equal(
            seed.TemplateId,
            plan.ScheduleRules.Single(x => x.DayOfWeek == DayOfWeek.Monday).WorkoutTemplateId);
        Assert.Equal(
            newTemplate.Id,
            plan.ScheduleRules.Single(x => x.DayOfWeek == DayOfWeek.Thursday).WorkoutTemplateId);
        Assert.Null(plan.ScheduleRules.Single(x => x.DayOfWeek == DayOfWeek.Sunday).WorkoutTemplateId);
    }

    // Отхвърлянето не оставя нито програма, нито шаблон
    [Fact]
    public async Task Reject_LeavesNothingBehind()
    {
        using var factory = new TestWebApplicationFactory();
        var (client, action, seed) = await ProposeProgramAsync(factory, "program-reject@test.local");

        var response = await client.PostAsync($"/api/ai/actions/{action.Id}/reject", null);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIActionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(AIActionStatus.Rejected, body.Data!.Status);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await dbContext.ProgramPlans.ToListAsync());
        Assert.Empty(await dbContext.WorkoutTemplates.Where(x => x.Name == "Lower A").ToListAsync());
    }

    // Промяната на активна програма пренарежда само бъдещите дни
    [Fact]
    public async Task ProposeUpdate_Confirmed_ReschedulesFutureDaysOnly()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("program-update@test.local");
        var seed = await SeedAsync(factory, "program-update@test.local");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var createResponse = await client.PostAsJsonAsync("/api/program-plans", new SaveProgramPlanRequest
        {
            Name = "Running plan",
            Goal = TrainingGoal.Endurance,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = today,
            EndDate = today.AddDays(28),
            TargetWorkoutsPerWeek = 7,
            ScheduleRules = Enum.GetValues<DayOfWeek>()
                .Select((day, index) => new ProgramScheduleRuleRequest
                {
                    DayOfWeek = day,
                    DayType = ProgramPlanDayType.Workout,
                    WorkoutTemplateId = seed.TemplateId,
                    WeekInterval = 1,
                    OrderIndex = index,
                })
                .ToList(),
        });
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();
        var planId = created!.Data!.Id;
        (await client.PostAsync($"/api/program-plans/{planId}/activate", null)).EnsureSuccessStatusCode();

        factory.Services.GetRequiredService<FakeAICompletionProvider>()
            .EnqueueToolCall(
                "call-1",
                "propose_program_update",
                $$"""
                {
                  "programPlanId": {{planId}},
                  "reason": "You said seven days a week is too much.",
                  "workoutsPerWeek": 1,
                  "schedule": [
                    { "dayOfWeek": "Wednesday", "dayType": "Workout", "existingWorkoutTemplateId": {{seed.TemplateId}} }
                  ]
                }
                """)
            .EnqueueText("Here is a lighter week.");

        var conversationResponse = await client.PostAsJsonAsync(
            "/api/ai/conversations",
            new CreateAIConversationRequest());
        var conversation = await conversationResponse.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation!.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "Make it lighter." });
        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<SendAIMessageResponse>>();
        var action = Assert.Single(body!.Data!.Actions);

        Assert.Equal(AIActionType.UpdateProgramPlan, action.ActionType);
        Assert.Contains(action.Preview.Lines, x => x.Label == "Why");

        var confirmed = await client.PostAsync($"/api/ai/actions/{action.Id}/confirm", null);
        confirmed.EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Днес остава непокътнат; от утре нататък се тренира само в сряда
        Assert.True(await dbContext.ProgramPlanDays.AnyAsync(x => x.ScheduledDate == today));
        var futureDays = await dbContext.ProgramPlanDays
            .Where(x => x.ScheduledDate > today)
            .ToListAsync();

        Assert.NotEmpty(futureDays);
        Assert.All(futureDays, day =>
            Assert.Equal(DayOfWeek.Wednesday, day.ScheduledDate.DayOfWeek));
    }

    // Чужд шаблон в графика се отхвърля още при предлагането
    [Fact]
    public async Task ProposeProgram_WithForeignTemplate_ReturnsNoAction()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.CreateUserClientAsync("program-stranger@test.local");
        var strangerSeed = await SeedAsync(factory, "program-stranger@test.local");

        var client = await factory.CreateUserClientAsync("program-victim@test.local");
        await SeedAsync(factory, "program-victim@test.local");

        factory.Services.GetRequiredService<FakeAICompletionProvider>()
            .EnqueueToolCall(
                "call-1",
                "propose_program_plan",
                $$"""
                {
                  "name": "Borrowed",
                  "goal": "Strength",
                  "scheduleType": "FixedWeekdays",
                  "startDate": "2026-01-05",
                  "workoutsPerWeek": 1,
                  "schedule": [
                    { "dayOfWeek": "Monday", "dayType": "Workout", "existingWorkoutTemplateId": {{strangerSeed.TemplateId}} }
                  ]
                }
                """)
            .EnqueueText("I could not use that template.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation!.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "Use that other person's template." });
        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<SendAIMessageResponse>>();

        Assert.True(body!.Success);
        Assert.Empty(body.Data!.Actions);
    }
}
