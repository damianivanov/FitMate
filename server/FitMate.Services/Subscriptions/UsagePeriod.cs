namespace FitMate.Services.Subscriptions;

/// <summary>
/// A usage window. Periods are calendar months in UTC.
/// </summary>
public readonly record struct UsagePeriod(DateOnly Start, DateOnly End)
{
    public static UsagePeriod CurrentMonth() => ForDate(DateOnly.FromDateTime(DateTime.UtcNow));

    public static UsagePeriod ForDate(DateOnly date)
    {
        var start = new DateOnly(date.Year, date.Month, 1);
        return new UsagePeriod(start, start.AddMonths(1).AddDays(-1));
    }

    public DateTime ResetsAt => End.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
