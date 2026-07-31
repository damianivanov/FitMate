namespace FitMate.Core.Settings;

/// <summary>Retention windows. Stored now; the cleanup jobs that enforce them arrive with Plan 11.</summary>
public class AIRetentionOptions
{
    public int ConversationRetentionDays { get; set; } = 365;
    public int OperationalLogRetentionDays { get; set; } = 180;
    public int TemporaryUploadRetentionHours { get; set; } = 24;
    public int ExpiredActionRetentionDays { get; set; } = 90;
}
