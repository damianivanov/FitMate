using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.Auth;
using FitMate.DB;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AuthApiTests
{
    // Регистрация на нов потребител успява
    [Fact]
    public async Task Register_ValidUser_ReturnsSuccess()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.RegisterAsync("new-user@test.local");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.True(body!.Success);
        Assert.True(body.Data!.Success);
        Assert.Equal("Registration successful. Please login.", body.Data.Message);
    }

    // Дублиран имейл връща грешка при регистрация
    [Fact]
    public async Task Register_DuplicateEmail_ReturnsError()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        await client.RegisterAsync("dupe@test.local");
        var response = await client.RegisterAsync("dupe@test.local");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.False(body!.Success);
        Assert.Equal("User with this email already exists.", body.Error);
    }

    // Валиден вход връща потребител и Token бисквитка
    [Fact]
    public async Task Login_ValidCredentials_ReturnsUserAndSetsTokenCookie()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("login-ok@test.local");

        var response = await client.LoginAsync("login-ok@test.local");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.True(body!.Success);
        Assert.Equal("login-ok@test.local", body.Data!.User!.Email);
        Assert.False(string.IsNullOrEmpty(IntegrationTestExtensions.ExtractCookie(response, "Token")));
    }

    // Грешна парола връща невалиден имейл или парола
    [Fact]
    public async Task Login_InvalidPassword_ReturnsError()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("wrong-pw@test.local");

        var response = await client.LoginAsync("wrong-pw@test.local", "WrongPassword1");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.False(body!.Success);
        Assert.Equal("Invalid email or password.", body.Error);
    }

    // Неактивен потребител не може да влезе
    [Fact]
    public async Task Login_InactiveUser_ReturnsError()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("inactive@test.local");

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await dbContext.Users.SingleAsync(x => x.Email == "inactive@test.local");
            user.IsActive = false;
            await dbContext.SaveChangesAsync();
        }

        var response = await client.LoginAsync("inactive@test.local");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.False(body!.Success);
        Assert.Equal("Invalid email or password.", body.Error);
    }

    // С токен връща влезлия потребител
    [Fact]
    public async Task CurrentUser_WithToken_ReturnsLoggedInUser()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("current@test.local");

        var response = await client.GetAsync("/api/auth/current-user");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UserModel>>();

        Assert.Equal("current@test.local", body!.Data!.Email);
    }

    // Без токен връща празен потребител
    [Fact]
    public async Task CurrentUser_WithoutToken_ReturnsEmptyUser()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/auth/current-user");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UserModel>>();

        Assert.Equal(0, body!.Data!.Id);
        Assert.Equal(string.Empty, body.Data.Email);
    }

    // Изход изтрива Token бисквитката
    [Fact]
    public async Task Logout_Authenticated_ClearsTokenCookie()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("logout@test.local");

        var response = await client.PostAsync("/api/auth/logout", content: null);
        response.EnsureSuccessStatusCode();

        Assert.Equal(string.Empty, IntegrationTestExtensions.ExtractCookie(response, "Token"));
    }

    // Валиден refresh токен издава нов Token
    [Fact]
    public async Task Refresh_WithValidRefreshToken_ReturnsUserAndNewToken()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("refresh-ok@test.local");

        using var loginResponse = await client.LoginAsync("refresh-ok@test.local");
        var refreshToken = IntegrationTestExtensions.ExtractCookie(loginResponse, "RefreshToken");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", $"RefreshToken={refreshToken}");
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.True(body!.Success);
        Assert.Equal("refresh-ok@test.local", body.Data!.User!.Email);
        Assert.False(string.IsNullOrEmpty(IntegrationTestExtensions.ExtractCookie(response, "Token")));
    }

    // Липсващ refresh токен връща грешка
    [Fact]
    public async Task Refresh_WithoutRefreshToken_ReturnsError()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.PostAsync("/api/auth/refresh", content: null);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();

        Assert.False(body!.Success);
        Assert.Equal("Refresh token is required.", body.Error);
    }

    // Анулиран токен се отхвърля със 401
    [Fact]
    public async Task RevokedToken_IsRejectedOnProtectedEndpoint()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("revoked@test.local");

        using var loginResponse = await client.LoginAsync("revoked@test.local");
        var token = IntegrationTestExtensions.ExtractCookie(loginResponse, "Token")!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var before = await client.GetAsync("/api/exercises/get-all");
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await dbContext.Tokens.SingleAsync(x => x.Value == token);
            stored.RevokedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            await dbContext.SaveChangesAsync();
        }

        var after = await client.GetAsync("/api/exercises/get-all");
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }

    // Токен след изход връща 401
    [Fact]
    public async Task Logout_ThenReusingBearerToken_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("logout-revoke@test.local");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/exercises/get-all")).StatusCode);

        var logout = await client.PostAsync("/api/auth/logout", content: null);
        logout.EnsureSuccessStatusCode();

        var after = await client.GetAsync("/api/exercises/get-all");
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }
}
