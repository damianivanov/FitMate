using FitMate.Core.Common;
using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace FitMate.Web.Attributes;

public class LogApiErrorAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.ExceptionHandled)
        {
            return;
        }

        if (context.Exception is FitMateException)
        {
            context.ExceptionHandled = true;
            context.Result = new JsonResult(new CommonJsonModel<object?>(error: context.Exception.Message, data: null))
            {
                StatusCode = StatusCodes.Status400BadRequest,
            };
            return;
        }

        try
        {
            using var serviceScope = context.HttpContext.RequestServices.CreateScope();
            using var dbContext = serviceScope.ServiceProvider.GetRequiredService<AppDbContext>();

            long? userId = null;
            if (long.TryParse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var error = new Error
            {
                Source = context.Exception.Source,
                Action = context.ActionDescriptor.DisplayName,
                RequestUrl = $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}{context.HttpContext.Request.QueryString}",
                UserAgent = context.HttpContext.Request.Headers.UserAgent.ToString(),
                Message = context.Exception.Message,
                Exception = context.Exception.ToString(),
            };

            dbContext.Errors.Add(error);
            dbContext.SaveChanges(userId);
        }
        catch
        {
        }

        context.ExceptionHandled = true;
        context.Result = new JsonResult(new CommonJsonModel<object?>(error: "An error occurred while executing the request.", data: null))
        {
            StatusCode = StatusCodes.Status500InternalServerError,
        };
    }
}
