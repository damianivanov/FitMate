using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AdminGridApiTests
{
    [Fact]
    public async Task UserPlanOptionsUseEffectiveOverrides_AndFilterBeforePagination()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();
        await SeedAsync(factory, "users");
        long targetId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            targetId = await db.Users.Where(x => x.FirstName == "Option 00").Select(x => x.Id).SingleAsync();
            var adminId = await db.Users.Where(x => x.Email == TestWebApplicationFactory.AdminEmail).Select(x => x.Id).SingleAsync();
            var planId = await db.Plans.Where(x => x.Code == "pro").Select(x => x.Id).SingleAsync();
            db.UserPlanOverrides.Add(new UserPlanOverride
            {
                UserId = targetId, PlanId = planId, CreatedByUserId = adminId,
                Reason = "Grid test", IsActive = true, StartsAt = DateTime.UtcNow.AddDays(-1),
            });
            await db.SaveChangesAsync();
        }

        using var options = JsonDocument.Parse(await client.GetStringAsync("/api/admin/users/options"));
        var pro = options.RootElement.GetProperty("data").EnumerateArray()
            .Single(x => x.GetProperty("field").GetString() == "effectivePlanName")
            .GetProperty("options").EnumerateArray().Single(x => x.GetProperty("label").GetString() == "Pro");
        var response = await client.PostAsJsonAsync("/api/admin/users/query", new
        {
            page = 1, pageSize = 1,
            columnFilters = new[] { new GridColumnSelectionModel
            {
                Field = "effectivePlanName", Values = [pro.GetProperty("value").GetString()!],
            } },
        });
        response.EnsureSuccessStatusCode();
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = result.RootElement.GetProperty("data");
        Assert.Equal(1, data.GetProperty("totalCount").GetInt32());
        Assert.Equal(targetId, Assert.Single(data.GetProperty("items").EnumerateArray()).GetProperty("id").GetInt64());
    }

    [Fact]
    public async Task ConversationCostOptionsAndFiltersUseAllRunsAndIncludeZeroCost()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();
        await SeedAsync(factory, "ai/conversations");
        long targetId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var conversation = await db.AIConversations.SingleAsync(x => x.Title == "Option 00");
            targetId = conversation.Id;
            foreach (var cost in new[] { 0.01m, 0.02m })
            {
                db.AIRuns.Add(new AIRun
                {
                    UserId = conversation.UserId, ConversationId = conversation.Id,
                    ClientRequestId = Guid.NewGuid().ToString(), Provider = "test", Model = "test",
                    PromptVersion = "v1", EstimatedCost = cost,
                });
            }
            await db.SaveChangesAsync();
        }

        using var options = JsonDocument.Parse(await client.GetStringAsync("/api/admin/ai/conversations/options"));
        var costs = options.RootElement.GetProperty("data").EnumerateArray()
            .Single(x => x.GetProperty("field").GetString() == "estimatedCost").GetProperty("options");
        Assert.Equal(2, costs.GetArrayLength());
        var value = costs.EnumerateArray().Single(x => x.GetProperty("label").GetString() == "$0.0300")
            .GetProperty("value").GetString()!;
        var response = await client.PostAsJsonAsync("/api/admin/ai/conversations/query", new
        {
            page = 1, pageSize = 1,
            columnFilters = new[] { new GridColumnSelectionModel { Field = "estimatedCost", Values = [value] } },
        });
        response.EnsureSuccessStatusCode();
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = result.RootElement.GetProperty("data");
        Assert.Equal(1, data.GetProperty("totalCount").GetInt32());
        var item = Assert.Single(data.GetProperty("items").EnumerateArray());
        Assert.Equal(targetId, item.GetProperty("id").GetInt64());
        Assert.Equal(2, item.GetProperty("runCount").GetInt32());
        Assert.Equal(0.03m, item.GetProperty("estimatedCost").GetDecimal());
    }

    [Theory]
    [InlineData("exercises", "name", "loadBasis")]
    [InlineData("users", "email", "isActive")]
    [InlineData("musclegroups", "name", "imageUrl")]
    [InlineData("errors", "message", "source")]
    [InlineData("ai/conversations", "title", "status")]
    [InlineData("ai/unsupported-requests", "requestedFunctionality", "category")]
    public async Task OptionsAreCompleteAndSeparate_MultiSelectFiltersBeforePagination(
        string resource, string field, string secondField)
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();
        await SeedAsync(factory, resource);

        var optionsResponse = await client.GetAsync($"/api/admin/{resource}/options?page=99&pageSize=1");
        optionsResponse.EnsureSuccessStatusCode();
        using var optionsJson = JsonDocument.Parse(await optionsResponse.Content.ReadAsStringAsync());
        var columns = optionsJson.RootElement.GetProperty("data");
        var options = columns.EnumerateArray().Single(x => x.GetProperty("field").GetString() == field)
            .GetProperty("options").EnumerateArray()
            .Where(x => x.GetProperty("label").GetString()!.StartsWith("Option "))
            .ToList();
        Assert.Equal(12, options.Count);
        var selections = new List<GridColumnSelectionModel>
        {
            new() { Field = field, Values = options.Take(2).Select(x => x.GetProperty("value").GetString()!).ToList() },
        };

        async Task<JsonDocument> QueryAsync(int page) => JsonDocument.Parse(await (
            await client.PostAsJsonAsync($"/api/admin/{resource}/query", new
            {
                page, pageSize = 1, columnFilters = selections,
            })).Content.ReadAsStringAsync());

        using var first = await QueryAsync(1);
        var firstData = first.RootElement.GetProperty("data");
        Assert.Equal(2, firstData.GetProperty("totalCount").GetInt32());
        var firstId = Assert.Single(firstData.GetProperty("items").EnumerateArray()).GetProperty("id").GetInt64();
        using var second = await QueryAsync(2);
        var secondData = second.RootElement.GetProperty("data");
        Assert.Equal(2, secondData.GetProperty("totalCount").GetInt32());
        Assert.NotEqual(firstId, Assert.Single(secondData.GetProperty("items").EnumerateArray()).GetProperty("id").GetInt64());

        var otherOptions = columns.EnumerateArray().Single(x => x.GetProperty("field").GetString() == secondField)
            .GetProperty("options");
        selections.Add(new GridColumnSelectionModel
        {
            Field = secondField,
            Values = [otherOptions[0].GetProperty("value").GetString()!],
        });
        using var combined = await QueryAsync(1);
        Assert.Equal(1, combined.RootElement.GetProperty("data").GetProperty("totalCount").GetInt32());
    }

    [Theory]
    [InlineData("exercises")]
    [InlineData("users")]
    [InlineData("musclegroups")]
    [InlineData("errors")]
    [InlineData("ai/conversations")]
    [InlineData("ai/unsupported-requests")]
    public async Task OptionsAndQueriesRequireAdmin(string resource)
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("grid-user@test.local");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/admin/{resource}/options")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/admin/{resource}/query", new { })).StatusCode);
    }

    private static async Task SeedAsync(TestWebApplicationFactory factory, string resource)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users.Where(x => x.Email == TestWebApplicationFactory.AdminEmail).Select(x => x.Id).SingleAsync();
        var muscle = new MuscleGroup { Name = "Shared muscle" };
        db.MuscleGroups.Add(muscle);
        await db.SaveChangesAsync();

        for (var index = 0; index < 12; index++)
        {
            var label = $"Option {index:D2}";
            var even = index % 2 == 0;
            switch (resource)
            {
                case "exercises":
                    db.Exercises.Add(new Exercise
                    {
                        Name = label, Slug = $"option-{index}", PrimaryMuscleGroupId = muscle.Id,
                        LoadBasis = even ? ExerciseLoadBasis.Total : ExerciseLoadBasis.PerSide,
                    });
                    break;
                case "users":
                    db.Users.Add(new User
                    {
                        Email = label + "@test.local", UserName = $"option-{index}@test.local",
                        NormalizedEmail = $"OPTION-{index}@TEST.LOCAL", NormalizedUserName = $"OPTION-{index}@TEST.LOCAL",
                        FirstName = label, IsActive = even,
                    });
                    break;
                case "musclegroups":
                    db.MuscleGroups.Add(new MuscleGroup { Name = label, ImageUrl = even ? "https://example.com/image.png" : null });
                    break;
                case "errors":
                    db.Errors.Add(new Error { Message = label, RequestUrl = "/test", Source = even ? "A" : "B" });
                    break;
                case "ai/conversations":
                    db.AIConversations.Add(new AIConversation
                    {
                        UserId = userId, Title = label, LastMessageAt = DateTime.UtcNow,
                        Status = even ? AIConversationStatus.Active : AIConversationStatus.Archived,
                    });
                    break;
                case "ai/unsupported-requests":
                    db.UnsupportedAIRequests.Add(new UnsupportedAIRequest
                    {
                        UserId = userId, RequestedFunctionality = label, NormalizedKey = label,
                        Category = even ? "A" : "B", FirstRequestedAt = DateTime.UtcNow, LastRequestedAt = DateTime.UtcNow,
                    });
                    break;
            }
        }
        await db.SaveChangesAsync();
    }
}
