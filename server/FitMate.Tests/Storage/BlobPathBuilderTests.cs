using FitMate.Services.Storage.Blobs;

namespace FitMate.Tests.Storage;

public class BlobPathBuilderTests
{
    private static readonly DateTime FixedUtc = new(2026, 5, 30, 19, 20, 11, 921, DateTimeKind.Utc);

    [Fact]
    public void Build_ProducesModuleIdTimestampName()
    {
        var path = BlobPathBuilder.Build(StorageModule.Exercises, 42, "Bench Press.png", "jpg", FixedUtc);

        Assert.Equal("exercises/42/20260530T192011921Z-bench-press.jpg", path);
    }

    [Fact]
    public void Build_FallsBackToImageWhenNameEmpty()
    {
        var path = BlobPathBuilder.Build(StorageModule.Exercises, 1, "", "jpg", FixedUtc);

        Assert.Equal("exercises/1/20260530T192011921Z-image.jpg", path);
    }

    [Theory]
    [InlineData("..\\..\\evil\\hack.png", "hack.png")]
    [InlineData("My Photo!@#.JPG", "my-photo-.jpg")]
    [InlineData("a/b/c.png", "c.png")]
    public void Sanitize_StripsPathsAndIllegalChars(string input, string expected)
    {
        Assert.Equal(expected, BlobPathBuilder.Sanitize(input));
    }

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
}
