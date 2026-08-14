using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using FitMate.Core.JsonModels.Build;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// Reads the build stamp baked into the assembly by FitMate.Web.csproj. Resolved once: nothing here
/// can change while the process lives.
/// </summary>
public static class BuildInfo
{
    private const string BuildTimestampKey = "BuildTimestampUtc";

    private static readonly Lazy<BuildInfoModel> Cached = new(Resolve);

    public static BuildInfoModel Current => Cached.Value;

    private static BuildInfoModel Resolve()
    {
        var assembly = typeof(BuildInfo).Assembly;

        var stamp = assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(attribute => attribute.Key == BuildTimestampKey)
            ?.Value;

        var buildTimeUtc = DateTime.TryParse(
            stamp,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
            out var parsed)
            ? parsed
            : (DateTime?)null;

        return new BuildInfoModel
        {
            BuildTimeUtc = buildTimeUtc,
            Version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                ?? assembly.GetName().Version?.ToString()
                ?? string.Empty,
            CommitSha = Environment.GetEnvironmentVariable("GIT_COMMIT"),
            EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
            StartedAtUtc = ReadProcessStart(),
        };
    }

    /// <summary>Hardened container runtimes can deny process introspection, so a failure is not fatal.</summary>
    private static DateTime? ReadProcessStart()
    {
        try
        {
            return Process.GetCurrentProcess().StartTime.ToUniversalTime();
        }
        catch (Exception)
        {
            return null;
        }
    }
}
