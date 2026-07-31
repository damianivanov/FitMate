using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class SubscriptionApiTests
{
    // Без логин връща 401
    [Fact]
    public async Task SubscriptionEndpoints_WithoutAuth_Return401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/subscriptions/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Сийдът създава точно три плана и не ги дублира
    [Fact]
    public async Task Seeding_CreatesThreePlansExactlyOnce()
    {
        using var factory = new TestWebApplicationFactory();
        _ = factory.CreateApiClient();

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var codes = await context.Plans.Select(x => x.Code).ToListAsync();
        Assert.Equal(3, codes.Count);
        Assert.Contains(PlanCodes.Free, codes);
        Assert.Contains(PlanCodes.Plus, codes);
        Assert.Contains(PlanCodes.Pro, codes);
        Assert.Equal(codes.Count, codes.Distinct().Count());
    }

    // Нов потребител получава Free плана с наличности
    [Fact]
    public async Task GetMine_NewUser_ReturnsFreePlanWithUsage()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("subscriber@test.local");

        var response = await client.GetAsync("/api/subscriptions/me");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<CurrentSubscriptionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(PlanCodes.Free, body.Data!.PlanCode);
        Assert.NotEmpty(body.Data.Features);
        Assert.Equal(10, body.Data.Features.Single(x => x.Feature == SubscriptionFeature.AIChat).Limit);
    }

    // Публичните планове се връщат подредени
    [Fact]
    public async Task GetPlans_ReturnsPublicPlansOrdered()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plan-viewer@test.local");

        var response = await client.GetAsync("/api/subscriptions/plans");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<SubscriptionPlanModel>>>();

        Assert.True(body!.Success);
        Assert.Equal(3, body.Data!.Count);
        Assert.Equal(PlanCodes.Free, body.Data[0].Code);
    }

    // Изчерпан лимит връща 429 със spec §49 тяло
    [Fact]
    public async Task ExceedingTemplateLimit_Returns429WithLimitPayload()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("template-limit@test.local");

        long exerciseId;
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userId = await context.Users
                .Where(x => x.Email == "template-limit@test.local")
                .Select(x => x.Id)
                .SingleAsync();

            var muscleGroup = new FitMate.DB.Entities.MuscleGroup { Name = $"MG-{Guid.NewGuid():N}" };
            context.MuscleGroups.Add(muscleGroup);
            await context.SaveChangesAsync();

            var exercise = new FitMate.DB.Entities.Exercise
            {
                Name = $"Exercise {Guid.NewGuid():N}",
                Slug = $"exercise-{Guid.NewGuid():N}",
                IsPublic = true,
                PrimaryMuscleGroupId = muscleGroup.Id,
            };
            context.Exercises.Add(exercise);

            // Free разрешава 5 персонални шаблона: запълваме квотата.
            for (var i = 0; i < 5; i++)
            {
                context.WorkoutTemplates.Add(new FitMate.DB.Entities.WorkoutTemplate
                {
                    UserId = userId,
                    Name = $"Template {i}",
                });
            }

            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        var response = await client.PostAsJsonAsync("/api/workout-templates", new
        {
            name = "Sixth template",
            exercises = new[]
            {
                new
                {
                    groupType = (int)ExerciseGroupType.Straight,
                    exerciseId,
                    sets = new[] { new { setType = (int)ExerciseSetType.Working, reps = 8, weightKg = 60m } },
                },
            },
        });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SubscriptionLimitErrorModel>>();
        Assert.False(body!.Success);
        Assert.Equal("subscription_limit_reached", body.Data!.Code);
        Assert.Equal(SubscriptionFeature.CustomWorkoutTemplates, body.Data.Feature);
        Assert.Equal(5, body.Data.Limit);
        Assert.True(body.Data.UpgradeAvailable);
    }
}
