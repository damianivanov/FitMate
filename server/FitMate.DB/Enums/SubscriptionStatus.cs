namespace FitMate.DB.Enums;

public enum SubscriptionStatus
{
    Trialing = 1,
    Active = 2,
    PastDue = 3,
    Cancelled = 4,
    Unpaid = 5,
    Incomplete = 6,
    IncompleteExpired = 7,
    Paused = 8,
}
