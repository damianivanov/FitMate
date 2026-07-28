using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.TrainingProfiles;

public class TrainingProfileService : ITrainingProfileService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext dbContext;

    public TrainingProfileService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<TrainingProfileModel?> GetAsync(long userId)
    {
        var profile = await dbContext.UserTrainingProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId);

        return profile == null ? null : ToModel(profile);
    }

    public async Task<TrainingProfileModel> SaveAsync(SaveTrainingProfileRequest request, long userId)
    {
        Validate(request);

        var profile = await dbContext.UserTrainingProfiles
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (profile == null)
        {
            profile = new UserTrainingProfile { UserId = userId };
            dbContext.UserTrainingProfiles.Add(profile);
        }

        var equipment = request.AvailableEquipment
            .Select(e => (e ?? string.Empty).Trim())
            .Where(e => e.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var trainingDays = request.PreferredTrainingDays.Distinct().OrderBy(d => d).ToList();

        profile.Goal = request.Goal;
        profile.ExperienceLevel = request.ExperienceLevel;
        profile.PreferredTrainingDaysPerWeek = request.PreferredTrainingDaysPerWeek;
        profile.PreferredWorkoutDurationMinutes = request.PreferredWorkoutDurationMinutes;
        profile.WeightUnit = request.WeightUnit;
        profile.AvailableEquipmentJson = SerializeList(equipment);
        profile.PreferredTrainingDaysJson = SerializeList(trainingDays);
        profile.ExerciseRestrictions = NormalizeText(request.ExerciseRestrictions);
        profile.AdditionalPreferences = NormalizeText(request.AdditionalPreferences);
        profile.AllowAiPersonalization = request.AllowAiPersonalization;

        // DateModified is stamped by SaveChangesAsync and is what TrainingProfileModel.UpdatedAt reports.
        await dbContext.SaveChangesAsync();
        return ToModel(profile);
    }

    private static void Validate(SaveTrainingProfileRequest request)
    {
        if (!Enum.IsDefined(request.Goal))
        {
            throw new FitMateException("Invalid training goal.");
        }

        if (!Enum.IsDefined(request.ExperienceLevel))
        {
            throw new FitMateException("Invalid experience level.");
        }

        if (!Enum.IsDefined(request.WeightUnit))
        {
            throw new FitMateException("Invalid weight unit.");
        }

        if (request.PreferredTrainingDaysPerWeek is < 1 or > 7)
        {
            throw new FitMateException("Preferred training days per week must be between 1 and 7.");
        }

        if (request.PreferredWorkoutDurationMinutes is < 10 or > 600)
        {
            throw new FitMateException("Preferred workout duration must be between 10 and 600 minutes.");
        }

        if (request.AvailableEquipment.Count > 30
            || request.AvailableEquipment.Any(e => (e ?? string.Empty).Trim().Length > 100))
        {
            throw new FitMateException("Available equipment list is invalid.");
        }

        if (request.PreferredTrainingDays.Any(d => !Enum.IsDefined(d)))
        {
            throw new FitMateException("Preferred training days contain an invalid weekday.");
        }
    }

    private static string? SerializeList<T>(List<T> values) =>
        values.Count == 0 ? null : JsonSerializer.Serialize(values, JsonOptions);

    private static List<T> DeserializeList<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string? NormalizeText(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length > 2000 ? trimmed[..2000] : trimmed;
    }

    private static TrainingProfileModel ToModel(UserTrainingProfile profile) => new()
    {
        Goal = profile.Goal,
        ExperienceLevel = profile.ExperienceLevel,
        PreferredTrainingDaysPerWeek = profile.PreferredTrainingDaysPerWeek,
        PreferredWorkoutDurationMinutes = profile.PreferredWorkoutDurationMinutes,
        WeightUnit = profile.WeightUnit,
        AvailableEquipment = DeserializeList<string>(profile.AvailableEquipmentJson),
        PreferredTrainingDays = DeserializeList<DayOfWeek>(profile.PreferredTrainingDaysJson),
        ExerciseRestrictions = profile.ExerciseRestrictions,
        AdditionalPreferences = profile.AdditionalPreferences,
        AllowAiPersonalization = profile.AllowAiPersonalization,
        UpdatedAt = profile.DateModified ?? profile.DateCreated,
    };
}
