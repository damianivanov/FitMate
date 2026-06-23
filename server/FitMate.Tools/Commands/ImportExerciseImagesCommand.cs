using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitMate.Tools.Commands;

/// <summary>
/// Uploads a local folder of exercise images to Azure blob storage and wires each one to the
/// matching exercise. Mirrors <see cref="FitMate.Services.Exercises.ExerciseService.UploadImageAsync"/>
/// (process the image -> delete any previously uploaded owned blob -> upload -> persist the bare
/// file name) but runs without an HTTP context, acting as the first user that holds the Admin role.
/// </summary>
public sealed class ImportExerciseImagesCommand
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp",
    };

    private readonly AppDbContext dbContext;
    private readonly IImageProcessor imageProcessor;
    private readonly IBlobStorageService blobStorage;
    private readonly ApplicationSettings settings;
    private readonly ILogger<ImportExerciseImagesCommand> logger;

    public ImportExerciseImagesCommand(
        AppDbContext dbContext,
        IImageProcessor imageProcessor,
        IBlobStorageService blobStorage,
        ApplicationSettings settings,
        ILogger<ImportExerciseImagesCommand> logger)
    {
        this.dbContext = dbContext;
        this.imageProcessor = imageProcessor;
        this.blobStorage = blobStorage;
        this.settings = settings;
        this.logger = logger;
    }

    public async Task<int> RunAsync(string folderPath, bool dryRun)
    {
        if (!Directory.Exists(folderPath))
        {
            logger.LogError("Folder not found: {Folder}", folderPath);
            return 1;
        }

        // "everything should be done by the first user with admin role": resolve it up front and
        // abort if the target database has no admin, which is a strong signal it's the wrong DB.
        var admin = await ResolveFirstAdminAsync();
        if (admin == null)
        {
            logger.LogError(
                "No user with the '{Role}' role exists in this database. Aborting.", RoleNames.Admin);
            return 1;
        }

        logger.LogInformation(
            "Acting as admin {Email} (id {UserId}). Azure container '{Container}'.{DryRun}",
            admin.Email,
            admin.Id,
            settings.AzureStorageContainerName,
            dryRun ? " DRY RUN — no uploads or DB writes." : string.Empty);

        var files = Directory.EnumerateFiles(folderPath)
            .Where(path => ImageExtensions.Contains(Path.GetExtension(path)))
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (files.Count == 0)
        {
            logger.LogWarning(
                "No image files ({Extensions}) found in {Folder}.",
                string.Join(", ", ImageExtensions),
                folderPath);
            return 0;
        }

        var uploaded = 0;
        var unmatched = 0;
        var invalid = 0;
        var failed = 0;

        foreach (var file in files)
        {
            var slug = Path.GetFileNameWithoutExtension(file).Trim().ToLowerInvariant();
            try
            {
                switch (await ProcessFileAsync(file, slug, dryRun))
                {
                    case ImportResult.Uploaded:
                        uploaded++;
                        break;
                    case ImportResult.NoMatch:
                        unmatched++;
                        break;
                    case ImportResult.InvalidImage:
                        invalid++;
                        break;
                }
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogError(ex, "Failed to import {File} (slug '{Slug}').", Path.GetFileName(file), slug);
            }
        }

        logger.LogInformation(
            "Done. {Uploaded} uploaded, {Unmatched} unmatched, {Invalid} invalid, {Failed} failed (of {Total} files).",
            uploaded,
            unmatched,
            invalid,
            failed,
            files.Count);

        return failed > 0 ? 1 : 0;
    }

    private async Task<ImportResult> ProcessFileAsync(string file, string slug, bool dryRun)
    {
        var fileName = Path.GetFileName(file);

        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Slug == slug);
        if (exercise == null)
        {
            logger.LogWarning("No exercise matches slug '{Slug}' ({File}). Skipping.", slug, fileName);
            return ImportResult.NoMatch;
        }

        await using var stream = File.OpenRead(file);
        var processed = await imageProcessor.ProcessAsync(stream);
        if (processed == null)
        {
            logger.LogWarning("{File} is not a valid image. Skipping.", fileName);
            return ImportResult.InvalidImage;
        }

        if (dryRun)
        {
            logger.LogInformation(
                "[dry-run] Would upload {File} -> exercise {Id} '{Name}'.", fileName, exercise.Id, exercise.Name);
            return ImportResult.Uploaded;
        }

        // Replace any previously uploaded (owned) image, matching ExerciseService.UploadImageAsync.
        if (BlobPathBuilder.IsOwnedBlobPath(exercise.ImageUrl))
        {
            await blobStorage.DeleteByPrefixAsync($"{StorageModule.Exercises.ToFolder()}/{exercise.Id}/");
        }

        var blobPath = BlobPathBuilder.Build(
            StorageModule.Exercises, exercise.Id, fileName, processed.Extension, DateTime.UtcNow);
        await blobStorage.UploadAsync(processed.Content, blobPath, processed.ContentType);

        // Persist only the file name; the {module}/{id}/ prefix is rebuilt on read via BlobPathBuilder.Compose.
        exercise.ImageUrl = Path.GetFileName(blobPath);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Uploaded {File} -> exercise {Id} '{Name}'.", fileName, exercise.Id, exercise.Name);
        return ImportResult.Uploaded;
    }

    private async Task<User?> ResolveFirstAdminAsync()
    {
        var adminRoleId = await dbContext.Roles
            .Where(r => r.Name == RoleNames.Admin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        if (adminRoleId == 0)
        {
            return null;
        }

        var adminUserId = await dbContext.UserRoles
            .Where(ur => ur.RoleId == adminRoleId)
            .OrderBy(ur => ur.UserId)
            .Select(ur => ur.UserId)
            .FirstOrDefaultAsync();

        return adminUserId == 0
            ? null
            : await dbContext.Users.FirstOrDefaultAsync(u => u.Id == adminUserId);
    }

    private enum ImportResult
    {
        Uploaded,
        NoMatch,
        InvalidImage,
    }
}
