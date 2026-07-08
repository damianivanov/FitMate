using Serilog.Core;
using Serilog.Events;
using System.Security.Claims;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// Attaches request/user context (path, query string, user agent, user id, action) to every log
/// event so the <see cref="SerilogDatabaseSink"/> can persist rows to the Errors table that carry
/// the same context the exception filter records for unhandled errors.
/// </summary>
public class SerilogHttpContextDataEnricher : ILogEventEnricher
{
    public const string UserIdPropertyName = "UserId";
    public const string RequestPathPropertyName = "RequestPath";
    public const string RequestQueryStringPropertyName = "RequestQueryString";
    public const string UserAgentPropertyName = "UserAgent";
    public const string ActionPropertyName = "ActionName";

    private readonly IHttpContextAccessor httpContextAccessor;

    public SerilogHttpContextDataEnricher(IHttpContextAccessor httpContextAccessor)
    {
        this.httpContextAccessor = httpContextAccessor;
    }

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            // Logged outside a request (startup, background work). Message/exception are still captured.
            return;
        }

        if (long.TryParse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(UserIdPropertyName, userId));
        }

        var requestPath = httpContext.Request.Path.ToString();
        if (!string.IsNullOrWhiteSpace(requestPath))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(RequestPathPropertyName, requestPath));
        }

        var requestQueryString = httpContext.Request.QueryString.ToString();
        if (!string.IsNullOrWhiteSpace(requestQueryString))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(RequestQueryStringPropertyName, requestQueryString));
        }

        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        if (!string.IsNullOrWhiteSpace(userAgent))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(UserAgentPropertyName, userAgent));
        }

        var action = httpContext.GetEndpoint()?.DisplayName;
        if (!string.IsNullOrWhiteSpace(action))
        {
            logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(ActionPropertyName, action));
        }
    }
}
