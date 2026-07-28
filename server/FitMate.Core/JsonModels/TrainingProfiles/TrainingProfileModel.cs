using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.TrainingProfiles;

public class TrainingProfileModel
{
    public TrainingGoal Goal { get; set; }
    public TrainingExperienceLevel ExperienceLevel { get; set; }
    public int PreferredTrainingDaysPerWeek { get; set; }
    public int? PreferredWorkoutDurationMinutes { get; set; }
    public WeightUnit WeightUnit { get; set; }
    public List<string> AvailableEquipment { get; set; } = [];
    public List<DayOfWeek> PreferredTrainingDays { get; set; } = [];
    public string? ExerciseRestrictions { get; set; }
    public string? AdditionalPreferences { get; set; }
    public bool AllowAiPersonalization { get; set; }
    public DateTime UpdatedAt { get; set; }
}
