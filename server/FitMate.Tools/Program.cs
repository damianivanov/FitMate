using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using FitMate.Tools.Commands;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// Mirror the web host (FitMate.Web/Program.cs): the app stores all timestamps as UTC and maps
// DateTime to `timestamp without time zone`. Keep this in sync so writes from the tool match the app.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// Built without args so the command-line configuration provider does not choke on our own
// positional arguments (command name, folder path). We parse args by hand below instead.
var builder = Host.CreateApplicationBuilder();

builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false)
    .AddEnvironmentVariables();

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "HH:mm:ss ";
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty;

builder.Services.AddSingleton<ApplicationSettings>();
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IImageProcessor, ImageSharpImageProcessor>();
builder.Services.AddScoped<IBlobStorageService, AzureBlobStorageService>();
builder.Services.AddScoped<ImportExerciseImagesCommand>();
builder.Services.AddScoped<ConfigureBlobCorsCommand>();

using var host = builder.Build();

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();
var flags = args
    .Where(a => a.StartsWith("--", StringComparison.Ordinal))
    .Select(a => a.ToLowerInvariant())
    .ToHashSet();

if (positional.Length == 0 || flags.Contains("--help"))
{
    PrintUsage();
    return positional.Length == 0 ? 1 : 0;
}

var command = positional[0].ToLowerInvariant();

// Most commands talk to the database; configure-blob-cors only touches Azure storage, so don't
// force a connection string on it.
if (command != "configure-blob-cors" && string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine(
        "ConnectionStrings:DefaultConnection is not configured. " +
        "Copy appsettings.Local.example.json to appsettings.Local.json and fill in the credentials.");
    return 1;
}

using var scope = host.Services.CreateScope();

try
{
    switch (command)
    {
        case "import-exercise-images":
            if (positional.Length < 2)
            {
                Console.Error.WriteLine("Missing <folder> argument.\n");
                PrintUsage();
                return 1;
            }

            var importer = scope.ServiceProvider.GetRequiredService<ImportExerciseImagesCommand>();
            return await importer.RunAsync(positional[1], dryRun: flags.Contains("--dry-run"));

        case "configure-blob-cors":
            var corsCommand = scope.ServiceProvider.GetRequiredService<ConfigureBlobCorsCommand>();
            return await corsCommand.RunAsync();

        default:
            Console.Error.WriteLine($"Unknown command: {positional[0]}\n");
            PrintUsage();
            return 1;
    }
}
catch (Exception ex)
{
    var logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("FitMate.Tools");
    logger.LogError("Command failed: {Error}", Flatten(ex));
    logger.LogDebug(ex, "Full error detail.");
    return 1;
}

static string Flatten(Exception ex)
{
    var messages = new List<string>();
    for (Exception? current = ex; current != null; current = current.InnerException)
    {
        messages.Add(current.Message);
    }

    return string.Join(" -> ", messages.Distinct());
}

static void PrintUsage()
{
    Console.WriteLine(
        """
        FitMate.Tools — one-off operational commands run directly against an environment.

        Usage:
          dotnet run -- <command> [options]

        Commands:
          import-exercise-images <folder> [--dry-run]
              Upload every image in <folder> to Azure blob storage and set it as the
              matching exercise's image, exactly like the in-app upload.
              Each file is matched to an exercise by slug: the file name without its
              extension must equal the exercise slug (e.g. bench-press.png -> "bench-press").
              --dry-run  Report what would happen without uploading or writing to the DB.

          configure-blob-cors
              Set account-level CORS on the storage account so browsers may PUT images
              directly to blob storage (the direct-to-storage upload flow). Run once per
              environment; allowed origins come from Application:AllowedOrigins and
              Application:ClientUrl, falling back to "*" if none are configured.
        """);
}
