using FitMate.Core.Settings;
using FitMate.DB.Entities;
using FitMate.Services.Users;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeUserService : IUserService
{
    public long? LoggedInUserId { get; set; }
    public bool LoggedInUserIsAdmin { get; set; }
    public User? LoggedInUser { get; set; }

    public ApplicationSettings ApplicationSettings =>
        throw new NotSupportedException("ApplicationSettings is not used by the services under test.");

    public void InvalidateLoggedInUserCache()
    {
    }

    public static FakeUserService ForUser(long userId) => new() { LoggedInUserId = userId };

    public static FakeUserService ForAdmin(long userId) =>
        new() { LoggedInUserId = userId, LoggedInUserIsAdmin = true };
}
