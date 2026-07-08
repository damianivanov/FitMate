using System.Net;
using System.Net.Http.Json;
using FitMate.DB;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ErrorLoggingApiTests
{
    // Model-validation 400s (which short-circuit before the exception filter) are now persisted to
    // the Errors table via the Serilog database sink.
    [Fact]
    public async Task ModelValidation400_IsPersistedToErrorsTable()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        // Invalid email fails [EmailAddress] -> automatic 400 from InvalidModelStateResponseFactory.
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "not-an-email", password = string.Empty });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var errors = await dbContext.Errors.AsNoTracking().ToListAsync();

        var logged = Assert.Single(errors, e => e.Message.Contains("Model validation failed"));
        Assert.Contains("/api/auth/login", logged.RequestUrl);
    }

    // Handled business errors (FitMateException, HTTP 400) must NOT flood the Errors table — the sink
    // skips the exception filter's own events and the filter never persists them itself.
    [Fact]
    public async Task BusinessError_IsNotPersistedToErrorsTable()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        await client.RegisterAsync("business-error@test.local");

        var response = await client.LoginAsync("business-error@test.local", "WrongPassword1");
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Invalid email or password", body);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var errors = await dbContext.Errors.AsNoTracking().ToListAsync();

        Assert.DoesNotContain(errors, e => e.Message.Contains("Invalid email or password"));
        Assert.DoesNotContain(errors, e => e.Message.Contains("Handled business error"));
    }
}
