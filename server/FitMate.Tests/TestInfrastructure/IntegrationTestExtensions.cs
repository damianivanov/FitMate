using System.Net.Http.Headers;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.Auth;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FitMate.Tests.TestInfrastructure;

public static class IntegrationTestExtensions
{
    public const string DefaultPassword = "Password123!";

    public static HttpClient CreateApiClient(this TestWebApplicationFactory factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    public static async Task<HttpClient> CreateUserClientAsync(
        this TestWebApplicationFactory factory,
        string email,
        string password = DefaultPassword)
    {
        var client = factory.CreateApiClient();
        await client.RegisterAsync(email, password);
        await client.AuthenticateAsync(email, password);
        return client;
    }

    public static async Task<HttpClient> CreateAdminClientAsync(this TestWebApplicationFactory factory)
    {
        var client = factory.CreateApiClient();
        await client.AuthenticateAsync(TestWebApplicationFactory.AdminEmail, TestWebApplicationFactory.AdminPassword);
        return client;
    }

    public static Task<HttpResponseMessage> RegisterAsync(
        this HttpClient client,
        string email,
        string password = DefaultPassword,
        string firstName = "Test",
        string lastName = "User") =>
        client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Email = email,
            Password = password,
            FirstName = firstName,
            LastName = lastName,
        });

    public static Task<HttpResponseMessage> LoginAsync(
        this HttpClient client,
        string email,
        string password = DefaultPassword) =>
        client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email,
            Password = password,
        });

    public static async Task AuthenticateAsync(this HttpClient client, string email, string password)
    {
        using var response = await client.LoginAsync(email, password);
        response.EnsureSuccessStatusCode();

        var token = ExtractCookie(response, "Token")
            ?? throw new InvalidOperationException("Login did not set a Token cookie.");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public static string? ExtractCookie(HttpResponseMessage response, string name)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            return null;
        }

        var prefix = name + "=";
        foreach (var cookie in cookies)
        {
            if (!cookie.StartsWith(prefix, StringComparison.Ordinal))
            {
                continue;
            }

            var value = cookie[prefix.Length..];
            var separator = value.IndexOf(';');
            return separator >= 0 ? value[..separator] : value;
        }

        return null;
    }
}
