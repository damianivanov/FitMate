using System.Text;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace FitMate.Tests.TestInfrastructure;

public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@fitmate.test";
    public const string AdminPassword = "Admin12345!";

    private const string TestSigningKey = "fitmate-integration-test-signing-key-0123456789";
    private const string TestIssuer = "FitMate";
    private const string TestAudience = "FitMate";

    private readonly SqliteConnection connection;

    public TestWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable("Jwt__SigningKey", TestSigningKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", TestIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", TestAudience);
        Environment.SetEnvironmentVariable("Jwt__ExpirationMinutes", "60");
        Environment.SetEnvironmentVariable("RefreshToken__SigningKey", TestSigningKey);
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", "DataSource=:memory:");

        connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            var descriptorsToRemove = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                    || d.ServiceType == typeof(DbContextOptions)
                    || (d.ServiceType.FullName != null
                        && d.ServiceType.FullName.Contains("IDbContextOptionsConfiguration")
                        && d.ServiceType.FullName.Contains(nameof(AppDbContext))))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));

            services
                .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                .PostConfigure<IConfiguration>((options, configuration) =>
                {
                    var signingKey = configuration["Jwt:SigningKey"];
                    if (!string.IsNullOrWhiteSpace(signingKey))
                    {
                        options.TokenValidationParameters.IssuerSigningKey =
                            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
                    }

                    options.TokenValidationParameters.ValidIssuer =
                        configuration["Jwt:Issuer"] ?? TestIssuer;
                    options.TokenValidationParameters.ValidAudience =
                        configuration["Jwt:Audience"] ?? TestAudience;
                });
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        SeedAsync(host.Services).GetAwaiter().GetResult();
        return host;
    }

    private static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;

        var dbContext = sp.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureCreatedAsync();

        var roleManager = sp.GetRequiredService<RoleManager<Role>>();
        foreach (var roleName in RoleNames.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new Role
                {
                    Name = roleName,
                    NormalizedName = roleName.ToUpperInvariant(),
                });
            }
        }

        var userManager = sp.GetRequiredService<UserManager<User>>();
        if (await userManager.FindByEmailAsync(AdminEmail) == null)
        {
            var admin = new User
            {
                UserName = AdminEmail,
                Email = AdminEmail,
                EmailConfirmed = true,
                IsActive = true,
            };

            await userManager.CreateAsync(admin, AdminPassword);
            await userManager.AddToRoleAsync(admin, RoleNames.Admin);
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            connection.Dispose();
        }
    }
}
