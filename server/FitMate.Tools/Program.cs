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

// Single source of truth for the available commands, shared by the interactive menu, the
// command-line dispatcher, and the usage text. Add a new command here and it shows up everywhere.
var commands = new List<ToolCommand>
{
    new(
        Name: "import-exercise-images",
        Summary: "Upload a folder of images and set each as the matching exercise's image (matched by slug).",
        RequiresDatabase: true,
        Run: async (scope, ctx) =>
        {
            string folder;
            bool dryRun;

            if (ctx.Interactive)
            {
                folder = PromptRequired("Folder containing the images");
                dryRun = PromptYesNo("Dry run (report only, no uploads or DB writes)?", defaultValue: false);
            }
            else
            {
                if (ctx.Positional.Length < 2)
                {
                    Console.Error.WriteLine("Missing <folder> argument.\n");
                    return 1;
                }

                folder = ctx.Positional[1];
                dryRun = ctx.Flags.Contains("--dry-run");
            }

            var importer = scope.ServiceProvider.GetRequiredService<ImportExerciseImagesCommand>();
            return await importer.RunAsync(folder, dryRun);
        }),
    new(
        Name: "configure-blob-cors",
        Summary: "Set account-level CORS so browsers may PUT images directly to blob storage.",
        RequiresDatabase: false,
        Run: async (scope, _) =>
        {
            var cors = scope.ServiceProvider.GetRequiredService<ConfigureBlobCorsCommand>();
            return await cors.RunAsync();
        }),
};

var positional = args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToArray();
var flags = args
    .Where(a => a.StartsWith("--", StringComparison.Ordinal))
    .Select(a => a.ToLowerInvariant())
    .ToHashSet();

if (flags.Contains("--help"))
{
    PrintUsage(commands);
    return 0;
}

ToolCommand? selected;
bool interactive;

if (positional.Length == 0)
{
    // No command on the command line — e.g. you just pressed F5 / ran `dotnet run`. Show a menu.
    selected = PromptForCommand(commands);
    if (selected == null)
    {
        return 0;
    }

    interactive = true;
}
else
{
    var name = positional[0].ToLowerInvariant();
    selected = commands.FirstOrDefault(c => c.Name == name);
    if (selected == null)
    {
        Console.Error.WriteLine($"Unknown command: {positional[0]}\n");
        PrintUsage(commands);
        return 1;
    }

    interactive = false;
}

// Most commands talk to the database; ones that don't (e.g. configure-blob-cors) shouldn't be
// blocked when only Azure settings are configured.
if (selected.RequiresDatabase && string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine(
        "ConnectionStrings:DefaultConnection is not configured. " +
        "Copy appsettings.Local.example.json to appsettings.Local.json and fill in the credentials.");
    return 1;
}

using var scope = host.Services.CreateScope();

try
{
    return await selected.Run(scope, new ToolContext(interactive, positional, flags));
}
catch (Exception ex)
{
    var logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("FitMate.Tools");
    logger.LogError("Command failed: {Error}", Flatten(ex));
    logger.LogDebug(ex, "Full error detail.");
    return 1;
}

// Renders the numbered menu and returns the chosen command, or null to exit (also on end-of-input,
// so a non-interactive/piped invocation with no command exits cleanly instead of looping).
static ToolCommand? PromptForCommand(IReadOnlyList<ToolCommand> commands)
{
    Console.WriteLine();
    Console.WriteLine("FitMate.Tools — choose a command to run:");
    Console.WriteLine();

    for (var i = 0; i < commands.Count; i++)
    {
        Console.WriteLine($"  {i + 1}. {commands[i].Name}");
        Console.WriteLine($"     {commands[i].Summary}");
    }

    Console.WriteLine("  0. Exit");
    Console.WriteLine();

    while (true)
    {
        Console.Write("Enter number or name: ");

        var input = Console.ReadLine();
        if (input == null)
        {
            return null;
        }

        input = input.Trim();
        if (input.Length == 0)
        {
            continue;
        }

        if (input is "0" or "q"
            || input.Equals("exit", StringComparison.OrdinalIgnoreCase)
            || input.Equals("quit", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (int.TryParse(input, out var index) && index >= 1 && index <= commands.Count)
        {
            return commands[index - 1];
        }

        var byName = commands.FirstOrDefault(c => c.Name.Equals(input, StringComparison.OrdinalIgnoreCase));
        if (byName != null)
        {
            return byName;
        }

        Console.WriteLine("  Not a valid choice — enter a number from the list or a command name.");
    }
}

static string PromptRequired(string label)
{
    while (true)
    {
        Console.Write($"{label}: ");

        var value = Console.ReadLine();
        if (value == null)
        {
            return string.Empty;
        }

        value = value.Trim().Trim('"');
        if (value.Length > 0)
        {
            return value;
        }

        Console.WriteLine("  A value is required.");
    }
}

static bool PromptYesNo(string label, bool defaultValue)
{
    Console.Write($"{label} [{(defaultValue ? "Y/n" : "y/N")}]: ");

    var value = Console.ReadLine()?.Trim().ToLowerInvariant();
    if (string.IsNullOrEmpty(value))
    {
        return defaultValue;
    }

    return value is "y" or "yes";
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

static void PrintUsage(IReadOnlyList<ToolCommand> commands)
{
    Console.WriteLine(
        """
        FitMate.Tools — one-off operational commands run directly against an environment.

        Run with no arguments (or press F5 in the IDE) to pick a command from an interactive menu,
        or pass one directly:

          dotnet run -- <command> [options]

        Commands:
        """);

    foreach (var command in commands)
    {
        Console.WriteLine($"  {command.Name}");
        Console.WriteLine($"      {command.Summary}");
    }

    Console.WriteLine(
        """

        import-exercise-images takes a <folder> argument and an optional --dry-run flag in
        command-line mode; the interactive menu prompts for both.
        """);
}

// Declared after the top-level statements, as required for a top-level program.
internal sealed record ToolCommand(
    string Name,
    string Summary,
    bool RequiresDatabase,
    Func<IServiceScope, ToolContext, Task<int>> Run);

internal sealed record ToolContext(bool Interactive, string[] Positional, HashSet<string> Flags);
