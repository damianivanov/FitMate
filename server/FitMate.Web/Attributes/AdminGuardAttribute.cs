using FitMate.Core.Common;
using FitMate.Services.Users;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FitMate.Web.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AdminGuardAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var userService = context.HttpContext.RequestServices.GetRequiredService<IUserService>();

        if (userService.LoggedInUserId == null)
        {
            context.Result = Error("Authentication is required.", StatusCodes.Status401Unauthorized);
            return;
        }

        if (!userService.LoggedInUserIsAdmin)
        {
            context.Result = Error("Administrator access is required.", StatusCodes.Status403Forbidden);
        }
    }

    private static JsonResult Error(string message, int statusCode) =>
        new(new CommonJsonModel<object?>(message)) { StatusCode = statusCode };
}
