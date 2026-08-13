using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AvatarServiceTests
{
    private static AvatarService BuildService(
        AppDbContext context,
        FakeBlobStorageService blobStorage,
        FakeImageProcessor imageProcessor,
        long userId = SqliteTestDatabase.UserId)
    {
        return new AvatarService(context, FakeUserService.ForUser(userId), blobStorage, imageProcessor);
    }

    private static async Task SetAvatarAsync(AppDbContext context, long userId, string? avatarUrl)
    {
        var user = await context.Users.SingleAsync(x => x.Id == userId);
        user.AvatarUrl = avatarUrl;
        await context.SaveChangesAsync();
    }

    // Билетът за качване сочи към папката на самия потребител, не към подадена от клиента
    [Fact]
    public async Task CreateUploadTicketAsync_ScopesStagingPathToTheSignedInUser()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var blobStorage = new FakeBlobStorageService();

        var ticket = await BuildService(context, blobStorage, new FakeImageProcessor())
            .CreateUploadTicketAsync(new ImageUploadTicketRequest
            {
                FileName = "me.png",
                ContentType = "image/png",
            });

        Assert.StartsWith($"users/{SqliteTestDatabase.UserId}/incoming/", ticket.BlobName);
        Assert.EndsWith(".png", ticket.BlobName);
        Assert.Equal($"signed://write/{ticket.BlobName}", ticket.UploadUrl);
    }

    // Файл, който не е позволено изображение, се отхвърля преди да бъде издаден SAS
    [Fact]
    public async Task CreateUploadTicketAsync_UnsupportedContentType_ThrowsWithoutIssuingSas()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();

        var ex = await Assert.ThrowsAsync<FitMateException>(() =>
            BuildService(context, new FakeBlobStorageService(), new FakeImageProcessor())
                .CreateUploadTicketAsync(new ImageUploadTicketRequest
                {
                    FileName = "resume.pdf",
                    ContentType = "application/pdf",
                }));

        Assert.Equal(UploadConstraintsMessage, ex.Message);
    }

    // Потвърждаването записва аватара като голо име на файл и минава през квадратна обработка
    [Fact]
    public async Task ConfirmUploadAsync_StoresFileNameOnlyAndSquaresTheImage()
    {
        using var db = new SqliteTestDatabase();
        var blobStorage = new FakeBlobStorageService();
        var imageProcessor = new FakeImageProcessor();
        var stagingPath = $"users/{SqliteTestDatabase.UserId}/incoming/abc.jpg";
        blobStorage.StoredContent[stagingPath] = [1, 2, 3];

        using (var context = db.CreateContext())
        {
            await BuildService(context, blobStorage, imageProcessor)
                .ConfirmUploadAsync(new ConfirmImageUploadRequest { BlobName = stagingPath });
        }

        using var assert = db.CreateContext();
        var user = await assert.Users.SingleAsync(x => x.Id == SqliteTestDatabase.UserId);

        Assert.Equal(256, imageProcessor.RequestedSquareSize);
        Assert.NotNull(user.AvatarUrl);
        Assert.DoesNotContain("/", user.AvatarUrl);
        Assert.EndsWith("-avatar.jpg", user.AvatarUrl);
        Assert.Contains(blobStorage.UploadedPaths, path =>
            path == $"users/{SqliteTestDatabase.UserId}/{user.AvatarUrl}");
        Assert.Contains(stagingPath, blobStorage.DeletedPaths);
    }

    // Нов аватар изтрива предишния, за да не се трупат блобове за един потребител
    [Fact]
    public async Task ConfirmUploadAsync_ReplacingAnUploadedAvatar_DeletesThePreviousOne()
    {
        using var db = new SqliteTestDatabase();
        var blobStorage = new FakeBlobStorageService();
        var stagingPath = $"users/{SqliteTestDatabase.UserId}/incoming/abc.jpg";
        blobStorage.StoredContent[stagingPath] = [1, 2, 3];

        using (var seed = db.CreateContext())
        {
            await SetAvatarAsync(seed, SqliteTestDatabase.UserId, "20260101T000000000Z-avatar.jpg");
        }

        using (var context = db.CreateContext())
        {
            await BuildService(context, blobStorage, new FakeImageProcessor())
                .ConfirmUploadAsync(new ConfirmImageUploadRequest { BlobName = stagingPath });
        }

        Assert.Contains($"users/{SqliteTestDatabase.UserId}/", blobStorage.DeletedPrefixes);
    }

    // Не може да се потвърди чужд блоб: пътят трябва да е под собствената папка
    [Fact]
    public async Task ConfirmUploadAsync_BlobBelongingToAnotherUser_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var blobStorage = new FakeBlobStorageService();
        var foreignPath = $"users/{SqliteTestDatabase.OtherUserId}/incoming/abc.jpg";
        blobStorage.StoredContent[foreignPath] = [1, 2, 3];

        var ex = await Assert.ThrowsAsync<FitMateException>(() =>
            BuildService(context, blobStorage, new FakeImageProcessor())
                .ConfirmUploadAsync(new ConfirmImageUploadRequest { BlobName = foreignPath }));

        Assert.Equal("Invalid upload reference.", ex.Message);
        Assert.Empty(blobStorage.UploadedPaths);
    }

    // Качен файл, който не е изображение, не оставя нищо записано в профила
    [Fact]
    public async Task ConfirmUploadAsync_ContentIsNotAnImage_ThrowsAndLeavesTheProfileUntouched()
    {
        using var db = new SqliteTestDatabase();
        var blobStorage = new FakeBlobStorageService();
        var stagingPath = $"users/{SqliteTestDatabase.UserId}/incoming/abc.jpg";
        blobStorage.StoredContent[stagingPath] = [1, 2, 3];

        using (var context = db.CreateContext())
        {
            var service = BuildService(context, blobStorage, new FakeImageProcessor { Result = null });

            var ex = await Assert.ThrowsAsync<FitMateException>(() =>
                service.ConfirmUploadAsync(new ConfirmImageUploadRequest { BlobName = stagingPath }));

            Assert.Equal("The uploaded file is not a valid image.", ex.Message);
        }

        using var assert = db.CreateContext();
        var user = await assert.Users.SingleAsync(x => x.Id == SqliteTestDatabase.UserId);
        Assert.Null(user.AvatarUrl);
        Assert.Empty(blobStorage.UploadedPaths);
        // Стагинг блобът се чисти дори когато потвърждаването се провали.
        Assert.Contains(stagingPath, blobStorage.DeletedPaths);
    }

    // Премахване на качен аватар изтрива блоба и изчиства колоната
    [Fact]
    public async Task RemoveAsync_UploadedAvatar_DeletesBlobAndClearsTheColumn()
    {
        using var db = new SqliteTestDatabase();
        var blobStorage = new FakeBlobStorageService();

        using (var seed = db.CreateContext())
        {
            await SetAvatarAsync(seed, SqliteTestDatabase.UserId, "20260101T000000000Z-avatar.jpg");
        }

        using (var context = db.CreateContext())
        {
            await BuildService(context, blobStorage, new FakeImageProcessor()).RemoveAsync();
        }

        using var assert = db.CreateContext();
        var user = await assert.Users.SingleAsync(x => x.Id == SqliteTestDatabase.UserId);

        Assert.Null(user.AvatarUrl);
        Assert.Contains($"users/{SqliteTestDatabase.UserId}/", blobStorage.DeletedPrefixes);
    }

    // Външна снимка (от Google) не е наша, за да я трием — само връзката към нея отпада
    [Fact]
    public async Task RemoveAsync_ExternalPicture_ClearsTheColumnWithoutTouchingStorage()
    {
        using var db = new SqliteTestDatabase();
        var blobStorage = new FakeBlobStorageService();

        using (var seed = db.CreateContext())
        {
            await SetAvatarAsync(seed, SqliteTestDatabase.UserId, "https://lh3.googleusercontent.com/a/photo");
        }

        using (var context = db.CreateContext())
        {
            await BuildService(context, blobStorage, new FakeImageProcessor()).RemoveAsync();
        }

        using var assert = db.CreateContext();
        var user = await assert.Users.SingleAsync(x => x.Id == SqliteTestDatabase.UserId);

        Assert.Null(user.AvatarUrl);
        Assert.Empty(blobStorage.DeletedPrefixes);
    }

    private const string UploadConstraintsMessage =
        "Unsupported file type. Upload a JPEG, PNG, WebP, or GIF image.";
}
