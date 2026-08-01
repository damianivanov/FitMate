using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

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
        await SeedPlans(dbContext, environment.ContentRootPath);
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

    /// <summary>
    /// Seeds the Free/Plus/Pro plans. Idempotent and matched by stable code: descriptive fields are
    /// refreshed, but limits an administrator has edited are never overwritten.
    /// </summary>
    private static async Task SeedPlans(AppDbContext dbContext, string contentRootPath)
    {
        var seedPath = Path.Combine(contentRootPath, "SeedData", "plans.json");
        var items = await ReadSeedFileAsync<List<SeedPlan>>(seedPath);
        if (items == null || items.Count == 0)
        {
            return;
        }

        var existingPlans = await dbContext.Plans
            .Include(x => x.Entitlements)
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase);

        var hasChanges = false;

        foreach (var item in items)
        {
            var code = item.Code?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(code))
            {
                continue;
            }

            if (!existingPlans.TryGetValue(code, out var plan))
            {
                plan = new Plan { Code = code };
                dbContext.Plans.Add(plan);
                existingPlans[code] = plan;
                hasChanges = true;
            }

            plan.Name = item.Name?.Trim() ?? code;
            plan.Description = NormalizeOptionalString(item.Description);
            plan.IsPublic = item.IsPublic;
            plan.IsActive = true;
            plan.SortOrder = item.SortOrder;
            plan.AIModelTier = item.AIModelTier;

            foreach (var entitlementSeed in item.Entitlements)
            {
                if (plan.Entitlements.Any(x => x.Feature == entitlementSeed.Feature))
                {
                    continue;
                }

                plan.Entitlements.Add(new PlanEntitlement
                {
                    Feature = entitlementSeed.Feature,
                    IsEnabled = entitlementSeed.IsEnabled,
                    DailyLimit = entitlementSeed.DailyLimit,
                    MonthlyLimit = entitlementSeed.MonthlyLimit,
                    MaximumPerRequest = entitlementSeed.MaximumPerRequest,
                    SoftLimit = entitlementSeed.SoftLimit,
                    HardLimit = entitlementSeed.HardLimit,
                    ConfigurationJson = entitlementSeed.ConfigurationJson,
                });
                hasChanges = true;
            }
        }

        if (hasChanges || dbContext.ChangeTracker.HasChanges())
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private sealed class SeedPlan
    {
        public string? Code { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public bool IsPublic { get; set; }
        public int SortOrder { get; set; }
        public AIModelTier? AIModelTier { get; set; }
        public List<SeedPlanEntitlement> Entitlements { get; set; } = [];
    }

    private sealed class SeedPlanEntitlement
    {
        public SubscriptionFeature Feature { get; set; }
        public bool IsEnabled { get; set; }
        public int? DailyLimit { get; set; }
        public int? MonthlyLimit { get; set; }
        public int? MaximumPerRequest { get; set; }
        public int? SoftLimit { get; set; }
        public int? HardLimit { get; set; }
        public string? ConfigurationJson { get; set; }
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
            Converters = { new JsonStringEnumConverter() },
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
