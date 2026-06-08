using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FitMate.Web.Infrastructure;

public static class ApplicationBuilderExtensions
{
    public static void MigrateDatabase(this IApplicationBuilder app)
    {
        using var scope = app.ApplicationServices.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        dbContext.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));
        dbContext.Database.Migrate();
    }

    public static async Task SeedDatabase(this IApplicationBuilder app)
    {
        using var scope = app.ApplicationServices.CreateScope();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<Role>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var environment = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();

        await SeedRoles(roleManager);
        await SeedAdminUser(userManager, configuration);
        await SeedMuscleGroups(dbContext, environment.ContentRootPath);
        await SeedExercises(dbContext, environment.ContentRootPath);
    }

    private static async Task SeedRoles(RoleManager<Role> roleManager)
    {
        foreach (var roleName in RoleNames.All)
        {
            if (await roleManager.RoleExistsAsync(roleName))
            {
                continue;
            }

            await roleManager.CreateAsync(new Role
            {
                Name = roleName,
                NormalizedName = roleName.ToUpperInvariant(),
            });
        }
    }

    private static async Task SeedAdminUser(UserManager<User> userManager, IConfiguration configuration)
    {
        var adminEmail = configuration["AdminUser:Email"];
        var adminPassword = configuration["AdminUser:Password"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            return;
        }

        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin == null)
        {
            admin = new User
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                IsActive = true,
            };

            var createResult = await userManager.CreateAsync(admin, adminPassword);
            if (!createResult.Succeeded)
            {
                return;
            }
        }

        if (!await userManager.IsInRoleAsync(admin, RoleNames.Admin))
        {
            await userManager.AddToRoleAsync(admin, RoleNames.Admin);
        }
    }

    private static async Task SeedMuscleGroups(AppDbContext dbContext, string contentRootPath)
    {
        var seedPath = Path.Combine(contentRootPath, "SeedData", "muscle-groups.json");
        var items = await ReadSeedFileAsync<List<SeedMuscleGroup>>(seedPath);
        if (items == null || items.Count == 0)
        {
            return;
        }

        var existingByName = await dbContext.MuscleGroups
            .ToDictionaryAsync(x => x.Name, StringComparer.OrdinalIgnoreCase);

        var hasChanges = false;

        foreach (var item in items)
        {
            var name = item.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var imageUrl = NormalizeOptionalString(item.ImageUrl);
            if (existingByName.TryGetValue(name, out var existing))
            {
                if (!string.Equals(existing.ImageUrl, imageUrl, StringComparison.Ordinal))
                {
                    existing.ImageUrl = imageUrl;
                    hasChanges = true;
                }

                continue;
            }

            var created = new MuscleGroup
            {
                Name = name,
                ImageUrl = imageUrl,
            };

            dbContext.MuscleGroups.Add(created);
            existingByName[name] = created;
            hasChanges = true;
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private static async Task SeedExercises(
        AppDbContext dbContext,
        string contentRootPath)
    {
        var seedPath = Path.Combine(contentRootPath, "SeedData", "exercises.json");
        var items = await ReadSeedFileAsync<List<SeedExercise>>(seedPath);
        if (items == null || items.Count == 0)
        {
            return;
        }

        var muscleGroups = await dbContext.MuscleGroups
            .AsNoTracking()
            .Select(x => new { x.Id, x.Name })
            .ToListAsync();

        var muscleGroupNameById = muscleGroups.ToDictionary(x => x.Id, x => x.Name);
        var muscleGroupIdByName = muscleGroupNameById.ToDictionary(x => x.Value, x => x.Key, StringComparer.OrdinalIgnoreCase);

        var existingBySlug = await dbContext.Exercises
            .Where(x => x.UserId == null)
            .ToDictionaryAsync(x => x.Slug, StringComparer.OrdinalIgnoreCase);

        var hasChanges = false;

        foreach (var item in items)
        {
            var name = item.Name?.Trim();
            var slug = item.Slug?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(slug))
            {
                continue;
            }

            var primaryMuscleGroupName = NormalizeOptionalString(item.PrimaryMuscleGroupName);
            if (string.IsNullOrWhiteSpace(primaryMuscleGroupName))
            {
                continue;
            }

            if (!muscleGroupIdByName.TryGetValue(primaryMuscleGroupName, out var primaryMuscleGroupId))
            {
                continue;
            }

            long? secondaryMuscleGroupId = null;
            var secondaryMuscleGroupName = NormalizeOptionalString(item.SecondaryMuscleGroupName);
            if (!string.IsNullOrWhiteSpace(secondaryMuscleGroupName))
            {
                if (!muscleGroupIdByName.TryGetValue(secondaryMuscleGroupName, out var mappedSecondaryMuscleGroupId))
                {
                    continue;
                }

                if (mappedSecondaryMuscleGroupId != primaryMuscleGroupId)
                {
                    secondaryMuscleGroupId = mappedSecondaryMuscleGroupId;
                }
            }

            var description = NormalizeOptionalString(item.Description);
            var imageUrl = NormalizeOptionalString(item.ImageUrl);
            var videoUrl = NormalizeOptionalString(item.VideoUrl);

            if (existingBySlug.TryGetValue(slug, out var existing))
            {
                if (ApplyExerciseSeedChanges(existing, name, description, imageUrl, videoUrl, primaryMuscleGroupId, secondaryMuscleGroupId))
                {
                    hasChanges = true;
                }

                continue;
            }

            var created = new Exercise
            {
                UserId = null,
                IsPublic = true,
                Name = name,
                Slug = slug,
                Description = description,
                ImageUrl = imageUrl,
                VideoUrl = videoUrl,
                PrimaryMuscleGroupId = primaryMuscleGroupId,
                SecondaryMuscleGroupId = secondaryMuscleGroupId,
            };

            dbContext.Exercises.Add(created);
            existingBySlug[slug] = created;
            hasChanges = true;
        }

        if (hasChanges)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private static bool ApplyExerciseSeedChanges(
        Exercise entity,
        string name,
        string? description,
        string? imageUrl,
        string? videoUrl,
        long primaryMuscleGroupId,
        long? secondaryMuscleGroupId)
    {
        var hasChanges = false;

        if (!string.Equals(entity.Name, name, StringComparison.Ordinal))
        {
            entity.Name = name;
            hasChanges = true;
        }

        if (!string.Equals(entity.Description, description, StringComparison.Ordinal))
        {
            entity.Description = description;
            hasChanges = true;
        }

        if (!string.Equals(entity.ImageUrl, imageUrl, StringComparison.Ordinal))
        {
            entity.ImageUrl = imageUrl;
            hasChanges = true;
        }

        if (!string.Equals(entity.VideoUrl, videoUrl, StringComparison.Ordinal))
        {
            entity.VideoUrl = videoUrl;
            hasChanges = true;
        }

        if (entity.PrimaryMuscleGroupId != primaryMuscleGroupId)
        {
            entity.PrimaryMuscleGroupId = primaryMuscleGroupId;
            hasChanges = true;
        }

        if (entity.SecondaryMuscleGroupId != secondaryMuscleGroupId)
        {
            entity.SecondaryMuscleGroupId = secondaryMuscleGroupId;
            hasChanges = true;
        }

        return hasChanges;
    }

    private static async Task<T?> ReadSeedFileAsync<T>(string path)
    {
        if (!File.Exists(path))
        {
            return default;
        }

        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        });
    }

    private static string? NormalizeOptionalString(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private sealed class SeedMuscleGroup
    {
        public string Name { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
    }

    private sealed class SeedExercise
    {
        public long? UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public string PrimaryMuscleGroupName { get; set; } = string.Empty;
        public string? SecondaryMuscleGroupName { get; set; }
    }
}
