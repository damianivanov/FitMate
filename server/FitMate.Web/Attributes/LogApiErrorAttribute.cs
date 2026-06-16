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
    private readonly ILogger<LogApiErrorAttribute> logger;

    public LogApiErrorAttribute(ILogger<LogApiErrorAttribute> logger)
    {
        this.logger = logger;
    }

    public override void OnException(ExceptionContext context)
    {
        if (context.ExceptionHandled)
        {
            return;
        }

        var requestDescriptor =
            $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}{context.HttpContext.Request.QueryString}";

        if (context.Exception is FitMateException)
        {
            // Expected business/validation failure. It is intentionally not persisted to the
            // Errors table, so log it at warning level to keep it traceable in stdout/aggregated logs.
            logger.LogWarning(
                context.Exception,
                "Handled business error on {Request}: {Message}",
                requestDescriptor,
                context.Exception.Message);

            context.ExceptionHandled = true;
            context.Result = new JsonResult(new CommonJsonModel<object?>(error: context.Exception.Message, data: null))
            {
                StatusCode = StatusCodes.Status400BadRequest,
            };
            return;
        }

        // Emit to ILogger first so the failure is captured even if the Errors-table write below fails.
        logger.LogError(context.Exception, "Unhandled error on {Request}", requestDescriptor);

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
                RequestUrl = requestDescriptor,
                UserAgent = context.HttpContext.Request.Headers.UserAgent.ToString(),
                Message = context.Exception.Message,
                Exception = context.Exception.ToString(),
            };

            dbContext.Errors.Add(error);
            dbContext.SaveChanges(userId);
        }
        catch (Exception loggingException)
        {
            logger.LogError(loggingException, "Failed to persist API error to the Errors table.");
        }

        context.ExceptionHandled = true;
        context.Result = new JsonResult(new CommonJsonModel<object?>(error: "An error occurred while executing the request.", data: null))
        {
            StatusCode = StatusCodes.Status500InternalServerError,
        };
    }
}
