using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitMate.Services.Users;

public class UserService : IUserService
{
    private readonly IHttpContextAccessor contextAccessor;
    private readonly AppDbContext dbContext;
    private readonly ApplicationSettings applicationSettings;

    private bool userIdRetrieved;
    private long? cachedUserId;

    private bool userIsAdminRetrieved;
    private bool cachedUserIsAdmin;

    private bool userRetrieved;
    private User? cachedUser;

    public UserService(
        IHttpContextAccessor contextAccessor,
        AppDbContext dbContext,
        ApplicationSettings applicationSettings)
    {
        this.contextAccessor = contextAccessor;
        this.dbContext = dbContext;
        this.applicationSettings = applicationSettings;
    }

    public ApplicationSettings ApplicationSettings => applicationSettings;

    public long? LoggedInUserId
    {
        get
        {
            if (userIdRetrieved)
            {
                return cachedUserId;
            }

            userIdRetrieved = true;
            var userIdClaim = contextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (long.TryParse(userIdClaim, out var parsedUserId))
            {
                cachedUserId = parsedUserId;
            }

            return cachedUserId;
        }
    }

    public bool LoggedInUserIsAdmin
    {
        get
        {
            if (userIsAdminRetrieved)
            {
                return cachedUserIsAdmin;
            }

            userIsAdminRetrieved = true;
            cachedUserIsAdmin = contextAccessor.HttpContext?.User.IsInRole(RoleNames.Admin) == true;
            return cachedUserIsAdmin;
        }
    }

    public User? LoggedInUser
    {
        get
        {
            if (userRetrieved)
            {
                return cachedUser;
            }

            userRetrieved = true;
            var userId = LoggedInUserId;

            if (userId.HasValue)
            {
                cachedUser = dbContext.Users
                    .AsNoTracking()
                    .FirstOrDefault(x => x.Id == userId.Value);
            }

            return cachedUser;
        }
    }

    public void InvalidateLoggedInUserCache()
    {
        userIdRetrieved = false;
        cachedUserId = null;
        userIsAdminRetrieved = false;
        cachedUserIsAdmin = false;
        userRetrieved = false;
        cachedUser = null;
    }
}
