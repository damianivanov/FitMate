using System.Net;
using System.Net.Http.Json;
using FitMate.DB;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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

    // Hosting-infrastructure warnings describe deployment configuration, not application faults, and
    // must stay out of the admin error grid. These are the exact categories that filled production's
    // Errors table: the level overrides are matched against the full logger category, so they only
    // work when keyed by the real namespace (HttpsPolicy, not HttpsRedirection).
    [Theory]
    [InlineData("Microsoft.AspNetCore.HttpsPolicy.HttpsRedirectionMiddleware")]
    [InlineData("Microsoft.AspNetCore.DataProtection.Repositories.FileSystemXmlRepository")]
    [InlineData("Microsoft.AspNetCore.DataProtection.KeyManagement.XmlKeyManager")]
    public async Task HostingInfrastructureWarning_IsNotPersistedToErrorsTable(string category)
    {
        using var factory = new TestWebApplicationFactory();
        var loggerFactory = factory.Services.GetRequiredService<ILoggerFactory>();

        loggerFactory.CreateLogger(category).LogWarning("Failed to determine the https port for redirect.");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var errors = await dbContext.Errors.AsNoTracking().ToListAsync();

        Assert.DoesNotContain(errors, e => e.Source == category);
    }

    // Guards the override above from being widened into a blanket Microsoft.AspNetCore mute: warnings
    // the application itself raises still have to reach the grid.
    [Fact]
    public async Task ApplicationWarning_IsPersistedToErrorsTable()
    {
        using var factory = new TestWebApplicationFactory();
        var loggerFactory = factory.Services.GetRequiredService<ILoggerFactory>();

        loggerFactory.CreateLogger("FitMate.Services.Workouts.WorkoutService")
            .LogWarning("Something the application cares about");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var errors = await dbContext.Errors.AsNoTracking().ToListAsync();

        Assert.Contains(errors, e => e.Message.Contains("Something the application cares about"));
    }
}
