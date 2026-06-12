using Microsoft.Extensions.Configuration;

namespace FitMate.Core.Settings;

public class ApplicationSettings
{
    private readonly IConfiguration configuration;

    public ApplicationSettings(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    public string ConnectionString => configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string not configured.");

    public string JwtSigningKey => GetSetting("Jwt:SigningKey")
        ?? throw new InvalidOperationException("JWT signing key not configured.");

    public string JwtIssuer => GetSetting("Jwt:Issuer") ?? "FitMate";
    public string JwtAudience => GetSetting("Jwt:Audience") ?? "FitMate";
    public int JwtExpirationMinutes => ParseOrDefault(GetSetting("Jwt:ExpirationMinutes"), 60);

    public string RefreshTokenSigningKey => GetSetting("RefreshToken:SigningKey") ?? JwtSigningKey;
    public string RefreshTokenIssuer => GetSetting("RefreshToken:Issuer") ?? JwtIssuer;
    public string RefreshTokenAudience => GetSetting("RefreshToken:Audience") ?? JwtAudience;
    public int RefreshTokenExpirationDays => ParseOrDefault(GetSetting("RefreshToken:ExpirationDays"), 7);

    public string ApplicationUrl => GetSetting("Application:Url") ?? "http://localhost:5265";
    public string ClientUrl => GetSetting("Application:ClientUrl") ?? "http://localhost:5273";

    public string AdminEmail => GetSetting("AdminUser:Email") ?? string.Empty;
    public string AdminPassword => GetSetting("AdminUser:Password") ?? string.Empty;

    public string AzureStorageConnectionString => GetSetting("AzureStorage:ConnectionString") ?? string.Empty;
    public string AzureStorageContainerName => GetSetting("AzureStorage:ContainerName") ?? "media";
    public int AzureStorageSasMinutes => ParseOrDefault(GetSetting("AzureStorage:SasMinutes"), 15);

    public string GoogleClientId => GetSetting("Google:ClientId") ?? string.Empty;

    public string SmtpHost => GetSetting("Email:SmtpHost") ?? string.Empty;
    public int SmtpPort => ParseOrDefault(GetSetting("Email:SmtpPort"), 587);
    public string SmtpUser => GetSetting("Email:SmtpUser") ?? string.Empty;
    public string SmtpPassword => GetSetting("Email:SmtpPassword") ?? string.Empty;
    public string EmailFromAddress => GetSetting("Email:FromAddress") ?? string.Empty;
    public string EmailFromName => GetSetting("Email:FromName") ?? "FitMate";

    public string? HostingEnvironment => Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
    public bool IsDevelopment => "Development".Equals(HostingEnvironment, StringComparison.OrdinalIgnoreCase);
    public bool IsProduction => "Production".Equals(HostingEnvironment, StringComparison.OrdinalIgnoreCase);

    private string? GetSetting(string key)
    {
        var value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static int ParseOrDefault(string? value, int defaultValue)
    {
        return int.TryParse(value, out var parsed) ? parsed : defaultValue;
    }
}
