using FitMate.Core.Common;
using FitMate.DB.Constants;
using FitMate.Services.Users;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FitMate.Web.Attributes;

/// <summary>
/// Narrows access to the super administrator alone. Reserved for catalogue-wide operations that
/// every administrator could otherwise reach one record at a time, but which should not be handed
/// out in bulk — see <see cref="SystemUsers.SuperAdminId"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class SuperAdminGuardAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var userService = context.HttpContext.RequestServices.GetRequiredService<IUserService>();

        if (userService.LoggedInUserId == null)
        {
            context.Result = Error("Authentication is required.", StatusCodes.Status401Unauthorized);
            return;
        }

        if (!userService.LoggedInUserIsAdmin || userService.LoggedInUserId != SystemUsers.SuperAdminId)
        {
            context.Result = Error("Super administrator access is required.", StatusCodes.Status403Forbidden);
        }
    }

    private static JsonResult Error(string message, int statusCode) =>
        new(new CommonJsonModel<object?>(message)) { StatusCode = statusCode };
}
