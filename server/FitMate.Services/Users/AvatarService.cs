using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Users;

public class AvatarService : IAvatarService
{
    private readonly AppDbContext dbContext;
    private readonly IUserService userService;
    private readonly IBlobStorageService blobStorage;
    private readonly IImageProcessor imageProcessor;

    public AvatarService(
        AppDbContext dbContext,
        IUserService userService,
        IBlobStorageService blobStorage,
        IImageProcessor imageProcessor)
    {
        this.dbContext = dbContext;
        this.userService = userService;
        this.blobStorage = blobStorage;
        this.imageProcessor = imageProcessor;
    }

    public async Task<ImageUploadTicketModel> CreateUploadTicketAsync(ImageUploadTicketRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var contentType = request.ContentType?.Trim() ?? string.Empty;
        if (!UploadConstraints.IsAllowed(contentType))
        {
            throw new FitMateException(UploadConstraints.UnsupportedTypeMessage);
        }

        // The SAS is scoped to a path derived from the signed-in user, never from the request, so a
        // ticket can only ever write into the caller's own folder.
        var stagingPath = BlobPathBuilder.BuildStagingPath(
            AvatarStorage.Module,
            userId,
            UploadConstraints.ExtensionFor(contentType));

        var uploadUrl = await blobStorage.GetWriteUrlAsync(stagingPath, contentType);

        return new ImageUploadTicketModel
        {
            UploadUrl = uploadUrl,
            BlobName = stagingPath,
        };
    }

    public async Task ConfirmUploadAsync(ConfirmImageUploadRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var blobName = request.BlobName?.Trim() ?? string.Empty;
        if (!BlobPathBuilder.IsOwnStagingPath(AvatarStorage.Module, userId, blobName))
        {
            throw new FitMateException("Invalid upload reference.");
        }

        var staging = await blobStorage.DownloadAsync(blobName);
        if (staging == null)
        {
            throw new FitMateException("Upload not found. Please try uploading the image again.");
        }

        try
        {
            await using (staging)
            {
                // The browser PUT bypassed the app entirely, so the bytes are only trusted after
                // they have been re-decoded and re-encoded here.
                await StoreAsync(userId, staging);
            }
        }
        finally
        {
            // The finalized avatar now lives at its own path; drop the raw staging blob best-effort.
            try
            {
                await blobStorage.DeleteAsync(blobName);
            }
            catch
            {
                // Ignore cleanup failures; the live avatar is already in place.
            }
        }
    }

    public async Task RemoveAsync()
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");
        var user = await LoadUserAsync(userId);

        await DeleteOwnedAvatarAsync(user);

        user.AvatarUrl = null;
        await dbContext.SaveChangesAsync(userId);
        userService.InvalidateLoggedInUserCache();
    }

    private async Task StoreAsync(long userId, Stream content)
    {
        var user = await LoadUserAsync(userId);

        var processed = await imageProcessor.ProcessSquareAsync(content, AvatarStorage.SizePx);
        if (processed == null)
        {
            throw new FitMateException("The uploaded file is not a valid image.");
        }

        await DeleteOwnedAvatarAsync(user);

        var blobPath = BlobPathBuilder.Build(AvatarStorage.Module, userId, "avatar", processed.Extension, DateTime.UtcNow);
        await blobStorage.UploadAsync(processed.Content, blobPath, processed.ContentType);

        // Persist only the file name; the {module}/{id}/ prefix is rebuilt on read via BlobPathBuilder.Compose.
        user.AvatarUrl = Path.GetFileName(blobPath);
        await dbContext.SaveChangesAsync(userId);
        userService.InvalidateLoggedInUserCache();
    }

    private async Task<User> LoadUserAsync(long userId)
    {
        return await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new FitMateException("Unauthorized.");
    }

    private async Task DeleteOwnedAvatarAsync(User user)
    {
        // An external picture (the one Google supplied at sign-in) is not ours to delete — it is a
        // URL we merely point at, so only a blob we uploaded is swept.
        if (BlobPathBuilder.IsOwnedBlobPath(user.AvatarUrl))
        {
            await blobStorage.DeleteByPrefixAsync(BlobPathBuilder.OwnerPrefix(AvatarStorage.Module, user.Id));
        }
    }
}
