using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Enums;
using FitMate.Services.AI.Unsupported;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AdminAIApiTests
{
    private static async Task<long> SeedUnsupportedAsync(TestWebApplicationFactory factory, string email)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IUnsupportedRequestService>();
        var userId = await dbContext.Users.Where(x => x.Email == email).Select(x => x.Id).SingleAsync();

        return await service.RecordAsync(
            new RecordUnsupportedRequestRequest
            {
                Category = "integration",
                RequestedFunctionality = "Import my Apple Health workouts.",
                UserIntentSummary = "Wants automatic syncing.",
                SuggestedFallback = "Log workouts manually.",
                ConversationId = 1,
            },
            userId);
    }

    // Админските крайни точки не са достъпни за обикновен потребител
    [Fact]
    public async Task AdminEndpoints_AsNormalUser_AreForbidden()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("admin-ai-outsider@test.local");

        var response = await client.GetAsync("/api/admin/ai/overview");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Прегледът се връща и когато няма никакви данни
    [Fact]
    public async Task Overview_WithNoData_ReturnsEmptySummary()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/ai/overview?days=7");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIAdminOverviewModel>>();

        Assert.True(body!.Success);
        Assert.Equal(7, body.Data!.Days);
        Assert.Equal(0, body.Data.TotalRuns);
    }

    // Неподдържаните заявки се групират и се триажират от админ
    [Fact]
    public async Task UnsupportedRequests_ListAndTriage()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.CreateUserClientAsync("admin-ai-reporter@test.local");
        var id = await SeedUnsupportedAsync(factory, "admin-ai-reporter@test.local");
        var client = await factory.CreateAdminClientAsync();

        var listResponse = await client.GetAsync("/api/admin/ai/unsupported-requests");
        var list = await listResponse.Content
            .ReadFromJsonAsync<ApiResponse<PagedResponse<UnsupportedAIRequestModel>>>();

        var item = Assert.Single(list!.Data!.Items);
        Assert.Equal(id, item.Id);
        Assert.Equal(UnsupportedRequestStatus.New, item.Status);
        Assert.Equal(1, item.DistinctUserCount);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/admin/ai/unsupported-requests/{id}",
            new UpdateUnsupportedRequestRequest
            {
                Status = UnsupportedRequestStatus.Planned,
                AdminNotes = "Scheduled for Q4.",
                ExternalTrackingKey = "FIT-123",
            });
        var updated = await updateResponse.Content.ReadFromJsonAsync<ApiResponse<UnsupportedAIRequestModel>>();

        Assert.True(updated!.Success);
        Assert.Equal(UnsupportedRequestStatus.Planned, updated.Data!.Status);
        Assert.Equal("FIT-123", updated.Data.ExternalTrackingKey);

        // Детайлът показва кой е поискал функционалността
        var detailResponse = await client.GetAsync($"/api/admin/ai/unsupported-requests/{id}");
        var detail = await detailResponse.Content.ReadFromJsonAsync<ApiResponse<UnsupportedAIRequestModel>>();
        Assert.Equal(
            "admin-ai-reporter@test.local",
            Assert.Single(detail!.Data!.RecentOccurrences).UserEmail);
    }

    // Админ може да даде и да отнеме план на потребител
    [Fact]
    public async Task PlanOverride_CanBeAssignedAndRemoved()
    {
        using var factory = new TestWebApplicationFactory();
        await factory.CreateUserClientAsync("admin-ai-subject@test.local");
        var client = await factory.CreateAdminClientAsync();

        long userId;
        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            userId = await dbContext.Users
                .Where(x => x.Email == "admin-ai-subject@test.local")
                .Select(x => x.Id)
                .SingleAsync();
        }

        var assignResponse = await client.PostAsJsonAsync(
            $"/api/admin/subscriptions/{userId}/override",
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "Beta tester" });
        var assigned = await assignResponse.Content.ReadFromJsonAsync<ApiResponse<UserSubscriptionAdminModel>>();

        Assert.True(assigned!.Success);
        Assert.Equal(PlanCodes.Pro, assigned.Data!.EffectivePlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, assigned.Data.Source);

        var removeResponse = await client.DeleteAsync($"/api/admin/subscriptions/{userId}/override");
        var removed = await removeResponse.Content.ReadFromJsonAsync<ApiResponse<UserSubscriptionAdminModel>>();

        Assert.True(removed!.Success);
        Assert.Equal(PlanCodes.Free, removed.Data!.EffectivePlanCode);
    }

    // Плановете се четат и деактивират през админския контролер
    [Fact]
    public async Task SubscriptionPlans_ListAndDeactivate()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var listResponse = await client.GetAsync("/api/admin/subscription-plans");
        var list = await listResponse.Content
            .ReadFromJsonAsync<ApiResponse<List<SubscriptionPlanAdminModel>>>();

        Assert.True(list!.Success);
        var free = list.Data!.Single(x => x.Code == PlanCodes.Free);
        Assert.NotEmpty(free.Entitlements);

        var deactivateResponse = await client.PostAsync(
            $"/api/admin/subscription-plans/{free.Id}/active?isActive=false",
            null);
        var deactivated = await deactivateResponse.Content
            .ReadFromJsonAsync<ApiResponse<SubscriptionPlanAdminModel>>();

        Assert.True(deactivated!.Success);
        Assert.False(deactivated.Data!.IsActive);
    }
}
