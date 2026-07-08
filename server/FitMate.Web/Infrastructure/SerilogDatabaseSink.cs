using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Web.Attributes;
using Microsoft.EntityFrameworkCore;
using Serilog.Core;
using Serilog.Events;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// Persists Warning/Error/Fatal log events to the Errors table so the admin error grid captures
/// everything logged through <see cref="ILogger"/> — model-validation failures, service-level
/// warnings/errors, and background work — not just the unhandled 500s the exception filter records.
/// </summary>
public class SerilogDatabaseSink : ILogEventSink
{
    // The exception filter already persists unhandled exceptions (500s) with richer context and
    // deliberately does NOT persist handled business errors (FitMateException, HTTP 400). Skip its
    // events here so we neither duplicate 500 rows nor flood the table with expected business errors.
    private static readonly string? SkippedSourceContext = typeof(LogApiErrorAttribute).FullName;

    // Writing the row goes through EF Core, which itself logs at Warning+ on failure. Without this
    // guard a failed save could re-enter Emit and recurse. It is per-thread because Serilog invokes
    // Emit synchronously on the thread that raised the log event.
    [ThreadStatic]
    private static bool isEmitting;

    private readonly IServiceScopeFactory scopeFactory;

    public SerilogDatabaseSink(IServiceScopeFactory scopeFactory)
    {
        this.scopeFactory = scopeFactory;
    }

    public void Emit(LogEvent logEvent)
    {
        if (logEvent.Level < LogEventLevel.Warning || isEmitting)
        {
            return;
        }

        var source = GetProperty(logEvent, "SourceContext");
        if (source == SkippedSourceContext)
        {
            return;
        }

        isEmitting = true;
        try
        {
            var requestPath = GetProperty(logEvent, SerilogHttpContextDataEnricher.RequestPathPropertyName);
            var requestQueryString = GetProperty(logEvent, SerilogHttpContextDataEnricher.RequestQueryStringPropertyName);
            var userAgent = GetProperty(logEvent, SerilogHttpContextDataEnricher.UserAgentPropertyName);
            var action = GetProperty(logEvent, SerilogHttpContextDataEnricher.ActionPropertyName);
            var userIdText = GetProperty(logEvent, SerilogHttpContextDataEnricher.UserIdPropertyName);

            using var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Resolve the audit user defensively: CreatedById/ModifiedById reference the Users table,
            // so a stale id must not cause an FK failure that loses the error row entirely.
            long? userId = null;
            if (long.TryParse(userIdText, out var parsedUserId)
                && dbContext.Users.AsNoTracking().Any(u => u.Id == parsedUserId))
            {
                userId = parsedUserId;
            }

            var error = new Error
            {
                Source = logEvent.Exception?.Source ?? source,
                Action = action,
                RequestUrl = string.IsNullOrEmpty(requestPath) ? string.Empty : $"{requestPath}{requestQueryString}",
                UserAgent = userAgent,
                Message = $"[{logEvent.Level}] {logEvent.RenderMessage()}",
                Exception = logEvent.Exception?.ToString(),
            };

            dbContext.Errors.Add(error);
            dbContext.SaveChanges(userId);
        }
        catch
        {
            // Logging must never break the request or the app. The console sink still has the event.
        }
        finally
        {
            isEmitting = false;
        }
    }

    private static string? GetProperty(LogEvent logEvent, string name)
    {
        return logEvent.Properties.TryGetValue(name, out var value) && value is ScalarValue scalar
            ? scalar.Value?.ToString()
            : null;
    }
}
