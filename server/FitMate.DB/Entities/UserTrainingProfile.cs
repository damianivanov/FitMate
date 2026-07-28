using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UserTrainingProfile : BaseEntity
{
    public long UserId { get; set; }
    public User User { get; set; } = null!;

    public TrainingGoal Goal { get; set; }
    public TrainingExperienceLevel ExperienceLevel { get; set; }
    public int PreferredTrainingDaysPerWeek { get; set; }
    public int? PreferredWorkoutDurationMinutes { get; set; }
    public WeightUnit WeightUnit { get; set; } = WeightUnit.Kg;
    public string? AvailableEquipmentJson { get; set; }      // jsonb: string[] of equipment names
    public string? PreferredTrainingDaysJson { get; set; }   // jsonb: DayOfWeek[] (0 = Sunday)
    public string? ExerciseRestrictions { get; set; }
    public string? AdditionalPreferences { get; set; }
    public bool AllowAiPersonalization { get; set; } = true;
 }
