using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FitMate.DB;

/// <summary>
/// Used by the EF Core CLI (e.g. `dotnet ef migrations add`) so tooling can construct the
/// context without booting the web host (no JWT/secret config required). The connection
/// string is only needed for commands that hit the database; `migrations add` does not.
/// </summary>
public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Keep this in sync with Program.cs so generated migrations use the same
        // DateTime mapping (`timestamp without time zone`).
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=127.0.0.1;Port=5432;Database=fitmate;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
