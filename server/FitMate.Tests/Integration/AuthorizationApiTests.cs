using System.Net;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Integration;

public class AuthorizationApiTests
{
    // Защитен endpoint без логин връща 401
    [Theory]
    [InlineData("/api/exercises/get-all")]
    [InlineData("/api/workouts")]
    [InlineData("/api/analytics/overview")]
    public async Task ProtectedEndpoint_WithoutAuth_Returns401(string url)
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Публичен lookup на мускули без логин връща 200
    [Fact]
    public async Task AnonymousMuscleGroupLookup_WithoutAuth_Returns200()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/musclegroups/lookup");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // Логнат потребител достъпва защитен endpoint с 200
    [Fact]
    public async Task ProtectedEndpoint_WithAuth_Returns200()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("authed@test.local");

        var response = await client.GetAsync("/api/exercises/get-all");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // Admin endpoint без логин връща 401
    [Fact]
    public async Task AdminEndpoint_WithoutAuth_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Обикновен потребител към admin endpoint връща 403
    [Fact]
    public async Task AdminEndpoint_AsNonAdmin_Returns403()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("nonadmin@test.local");

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Admin достъпва admin endpoint с 200
    [Fact]
    public async Task AdminEndpoint_AsAdmin_Returns200()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
