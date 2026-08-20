using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.Tests.TestInfrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AdminExerciseImageApiTests
{
    private const string UploadUrlRoute = "/api/admin/exercises/images/upload-url";
    private const string ConfirmRoute = "/api/admin/exercises/images/confirm";

    private static async Task<(long ExerciseId, string Slug)> SeedGlobalExerciseAsync(
        TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var muscleGroup = new MuscleGroup { Name = $"Chest-{Guid.NewGuid():N}" };
        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync();

        var slug = $"barbell-squat-{Guid.NewGuid():N}";
        var exercise = new Exercise
        {
            Name = "Barbell Squat",
            Slug = slug,
            IsPublic = true,
            PrimaryMuscleGroupId = muscleGroup.Id,
        };

        dbContext.Exercises.Add(exercise);
        await dbContext.SaveChangesAsync();

        return (exercise.Id, slug);
    }

    /// <summary>
    /// An administrator who is not the super administrator: the guard keys off the user id, so the
    /// second admin account is what proves the role alone is not enough.
    /// </summary>
    private static async Task<HttpClient> CreateSecondAdminClientAsync(TestWebApplicationFactory factory)
    {
        var email = $"second-admin-{Guid.NewGuid():N}@test.local";
        var client = await factory.CreateUserClientAsync(email);

        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var user = await userManager.FindByEmailAsync(email)
                ?? throw new InvalidOperationException("The second admin was not registered.");

            Assert.NotEqual(SystemUsers.SuperAdminId, user.Id);
            await userManager.AddToRoleAsync(user, RoleNames.Admin);
        }

        // The role lands in the token, so re-authenticate to pick it up.
        await client.AuthenticateAsync(email, IntegrationTestExtensions.DefaultPassword);
        return client;
    }

    private static object TicketPayload(string slug) => new { slug, contentType = "image/png" };

    // Супер администраторът (id = 1) намира упражнението по slug и получава staging билет
    [Fact]
    public async Task CreateTicket_AsSuperAdmin_ResolvesSlugAndReturnsTicket()
    {
        using var factory = new TestWebApplicationFactory();
        var (exerciseId, slug) = await SeedGlobalExerciseAsync(factory);
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync(UploadUrlRoute, TicketPayload(slug));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());

        var data = json.RootElement.GetProperty("data");
        Assert.Equal(exerciseId, data.GetProperty("exerciseId").GetInt64());
        Assert.Equal("Barbell Squat", data.GetProperty("exerciseName").GetString());
        Assert.StartsWith(
            $"exercises/{exerciseId}/incoming/",
            data.GetProperty("blobName").GetString(),
            StringComparison.Ordinal);
    }

    // Администратор, който не е супер администраторът, няма достъп до групово качване
    [Fact]
    public async Task CreateTicket_AsNonSuperAdminAdmin_Returns403()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, slug) = await SeedGlobalExerciseAsync(factory);
        var client = await CreateSecondAdminClientAsync(factory);

        var response = await client.PostAsJsonAsync(UploadUrlRoute, TicketPayload(slug));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Обикновен потребител също получава 403
    [Fact]
    public async Task CreateTicket_AsNormalUser_Returns403()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, slug) = await SeedGlobalExerciseAsync(factory);
        var client = await factory.CreateUserClientAsync($"plain-{Guid.NewGuid():N}@test.local");

        var response = await client.PostAsJsonAsync(UploadUrlRoute, TicketPayload(slug));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Неразпознат slug връща 404, за да го отличи клиентът от истинска грешка при качване
    [Fact]
    public async Task CreateTicket_UnknownSlug_Returns404()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync(UploadUrlRoute, TicketPayload("no-such-exercise"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Contains("no-such-exercise", json.RootElement.GetProperty("error").GetString());
    }

    // Confirm със slug, който не съществува, също е 404, а не 500
    [Fact]
    public async Task Confirm_UnknownSlug_Returns404()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync(
            ConfirmRoute,
            new { slug = "no-such-exercise", blobName = "exercises/1/incoming/whatever.png" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // Пълният цикъл: билет -> байтове в staging -> confirm записва ImageUrl върху упражнението
    [Fact]
    public async Task Confirm_AsSuperAdmin_FinalizesImageOntoExercise()
    {
        using var factory = new TestWebApplicationFactory();
        var (exerciseId, slug) = await SeedGlobalExerciseAsync(factory);
        var client = await factory.CreateAdminClientAsync();

        var ticketResponse = await client.PostAsJsonAsync(UploadUrlRoute, TicketPayload(slug));
        using var ticketJson = JsonDocument.Parse(await ticketResponse.Content.ReadAsStringAsync());
        var blobName = ticketJson.RootElement.GetProperty("data").GetProperty("blobName").GetString()!;

        // Stand in for the browser's direct PUT to blob storage.
        var blobStorage = factory.Services.GetRequiredService<FakeBlobStorageService>();
        blobStorage.StoredContent[blobName] = [1, 2, 3];

        var response = await client.PostAsJsonAsync(ConfirmRoute, new { slug, blobName });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await dbContext.Exercises.FindAsync(exerciseId);
        Assert.False(string.IsNullOrWhiteSpace(persisted!.ImageUrl));
    }

    // Confirm също е зад същата преграда
    [Fact]
    public async Task Confirm_AsNonSuperAdminAdmin_Returns403()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, slug) = await SeedGlobalExerciseAsync(factory);
        var client = await CreateSecondAdminClientAsync(factory);

        var response = await client.PostAsJsonAsync(
            ConfirmRoute,
            new { slug, blobName = "exercises/1/incoming/whatever.png" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
