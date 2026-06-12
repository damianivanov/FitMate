using FitMate.Services.Storage.Blobs;

namespace FitMate.Tests.Storage;

public class BlobPathBuilderTests
{
    private static readonly DateTime FixedUtc = new(2026, 5, 30, 19, 20, 11, 921, DateTimeKind.Utc);

    // Гради път от модул, id, времеви печат и име
    [Fact]
    public void Build_ProducesModuleIdTimestampName()
    {
        var path = BlobPathBuilder.Build(StorageModule.Exercises, 42, "Bench Press.png", "jpg", FixedUtc);

        Assert.Equal("exercises/42/20260530T192011921Z-bench-press.jpg", path);
    }

    // Празно име дава резервно "image"
    [Fact]
    public void Build_FallsBackToImageWhenNameEmpty()
    {
        var path = BlobPathBuilder.Build(StorageModule.Exercises, 1, "", "jpg", FixedUtc);

        Assert.Equal("exercises/1/20260530T192011921Z-image.jpg", path);
    }

    // Маха пътища и непозволени символи от името
    [Theory]
    [InlineData("..\\..\\evil\\hack.png", "hack.png")]
    [InlineData("My Photo!@#.JPG", "my-photo-.jpg")]
    [InlineData("a/b/c.png", "c.png")]
    public void Sanitize_StripsPathsAndIllegalChars(string input, string expected)
    {
        Assert.Equal(expected, BlobPathBuilder.Sanitize(input));
    }

    // Разпознава само относителни пътища в контейнера
    [Theory]
    [InlineData("exercises/42/20260530T192011921Z-x.jpg", true)]
    [InlineData("muscle-groups/7/x.png", true)]
    [InlineData("https://fitnessbuddy.blob.core.windows.net/fitness-buddy/x.jpg", false)]
    [InlineData("http://example.com/x.png", false)]
    [InlineData("/images/muscle-groups/abs.png", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsOwnedBlobPath_DetectsOnlyRelativeContainerPaths(string? value, bool expected)
    {
        Assert.Equal(expected, BlobPathBuilder.IsOwnedBlobPath(value));
    }

    // Само голо име получава префикс {module}/{id}/; всичко друго остава непроменено
    [Theory]
    [InlineData("20260530T192011921Z-x.jpg", 42, "exercises/42/20260530T192011921Z-x.jpg")]
    [InlineData("exercises/42/20260530T192011921Z-x.jpg", 42, "exercises/42/20260530T192011921Z-x.jpg")]
    [InlineData("https://fitnessbuddy.blob.core.windows.net/fitness-buddy/x.jpg", 42, "https://fitnessbuddy.blob.core.windows.net/fitness-buddy/x.jpg")]
    [InlineData("/images/muscle-groups/abs.png", 42, "/images/muscle-groups/abs.png")]
    [InlineData(null, 42, null)]
    [InlineData("", 42, "")]
    public void Compose_RebuildsPathOnlyForBareNames(string? value, long id, string? expected)
    {
        Assert.Equal(expected, BlobPathBuilder.Compose(StorageModule.Exercises, id, value));
    }
}
