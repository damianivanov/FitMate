using FitMate.Core.Settings;
using FitMate.DB.Entities;

namespace FitMate.Services.Users;

public interface IUserService
{
    ApplicationSettings ApplicationSettings { get; }
    long? LoggedInUserId { get; }
    bool LoggedInUserIsAdmin { get; }
    User? LoggedInUser { get; }
    void InvalidateLoggedInUserCache();
}
