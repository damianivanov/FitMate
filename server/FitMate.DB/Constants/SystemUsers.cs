namespace FitMate.DB.Constants;

public static class SystemUsers
{
    /// <summary>
    /// The super administrator: the very first account in the database. Some catalogue-wide
    /// operations are reserved for it rather than for the Admin role at large, so the identity
    /// lives here instead of being written as a bare 1 at each guard.
    /// </summary>
    public const long SuperAdminId = 1;
}
