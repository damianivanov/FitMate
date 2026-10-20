using System.Text.Json;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Tests.TestInfrastructure;
using FitMate.Web.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ExerciseSeedImageTests
{
    private const string SeedImageUrl = "https://example.test/legacy-high-row.webp";
    private const string UploadedImage = "20261018T171342000Z-high-row.jpg";

    [Theory]
    [InlineData(SeedImageUrl)]
    [InlineData(null)]
    [InlineData("")]
    public async Task SeedDatabase_RepeatedStartup_PreservesUploadedExerciseImage(string? seedImageUrl)
    {
        using var factory = new TestWebApplicationFactory();
        await AddExerciseAsync(factory, UploadedImage);

        await RunSeedAsync(factory, seedImageUrl);
        await RunSeedAsync(factory, seedImageUrl);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var exercise = await db.Exercises.SingleAsync(x => x.Slug == "high-row");
        Assert.Equal(UploadedImage, exercise.ImageUrl);
        Assert.Equal("High Row", exercise.Name);
        Assert.Equal("Seeded description", exercise.Description);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public async Task SeedDatabase_ExistingExerciseWithoutImage_FillsSeedImage(string? currentImageUrl)
    {
        using var factory = new TestWebApplicationFactory();
        await AddExerciseAsync(factory, currentImageUrl);

        await RunSeedAsync(factory, SeedImageUrl);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var exercise = await db.Exercises.SingleAsync(x => x.Slug == "high-row");
        Assert.Equal(SeedImageUrl, exercise.ImageUrl);
    }

    [Fact]
    public async Task SeedDatabase_NewExercise_UsesSeedImage()
    {
        using var factory = new TestWebApplicationFactory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.MuscleGroups.Add(new MuscleGroup { Name = "Back" });
            await db.SaveChangesAsync();
        }

        await RunSeedAsync(factory, SeedImageUrl);

        using var readScope = factory.Services.CreateScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var exercise = await readDb.Exercises.SingleAsync(x => x.Slug == "high-row");
        Assert.Equal(SeedImageUrl, exercise.ImageUrl);
    }

    private static async Task AddExerciseAsync(TestWebApplicationFactory factory, string? imageUrl)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var group = new MuscleGroup { Name = "Back" };
        db.MuscleGroups.Add(group);
        await db.SaveChangesAsync();
        db.Exercises.Add(new Exercise
        {
            Name = "Existing row",
            Slug = "high-row",
            Description = "Existing description",
            ImageUrl = imageUrl,
            PrimaryMuscleGroupId = group.Id,
            IsPublic = true,
        });
        await db.SaveChangesAsync();
    }

    private static async Task RunSeedAsync(TestWebApplicationFactory factory, string? imageUrl)
    {
        var environment = factory.Services.GetRequiredService<IWebHostEnvironment>();
        var originalRoot = environment.ContentRootPath;
        var temporaryRoot = Directory.CreateTempSubdirectory("fitmate-seed-images-");
        try
        {
            var seedDirectory = Path.Combine(temporaryRoot.FullName, "SeedData");
            Directory.CreateDirectory(seedDirectory);
            await File.WriteAllTextAsync(Path.Combine(seedDirectory, "exercises.json"), JsonSerializer.Serialize(new[]
            {
                new
                {
                    Name = "High Row",
                    Slug = "high-row",
                    Description = "Seeded description",
                    ImageUrl = imageUrl,
                    PrimaryMuscleGroupName = "Back",
                },
            }));
            environment.ContentRootPath = temporaryRoot.FullName;
            await new ApplicationBuilder(factory.Services).SeedDatabase();
        }
        finally
        {
            environment.ContentRootPath = originalRoot;
            temporaryRoot.Delete(true);
        }
    }
}
