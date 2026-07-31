using FitMate.Services.AI.Tools.Proposals;
using FitMate.Services.AI.Tools.ReadOnly;
using FitMate.Services.AI.Unsupported;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Services.AI.Tools;

public static class AIToolServiceCollectionExtensions
{
    /// <summary>
    /// The tool allow-list. Registration is deliberately explicit rather than assembly-scanned:
    /// a handler is callable by the model only because it is named here, so adding a class can
    /// never widen what the AI can do by accident.
    /// </summary>
    public static IServiceCollection AddFitMateAITools(this IServiceCollection services)
    {
        // Read-only tools. These execute immediately and enforce ownership from AIToolContext.
        services.AddScoped<IAIToolHandler, GetTrainingProfileToolHandler>();
        services.AddScoped<IAIToolHandler, GetActiveProgramToolHandler>();
        services.AddScoped<IAIToolHandler, GetProgramCalendarToolHandler>();
        services.AddScoped<IAIToolHandler, GetSubscriptionUsageToolHandler>();
        services.AddScoped<IAIToolHandler, SearchExercisesToolHandler>();
        services.AddScoped<IAIToolHandler, GetRecentWorkoutsToolHandler>();
        services.AddScoped<IAIToolHandler, GetExerciseHistoryToolHandler>();
        services.AddScoped<IAIToolHandler, GetWorkoutTemplatesToolHandler>();

        // Proposal tools. These never write domain data: they record an AIAction for the user to
        // confirm, and the matching executor does the writing afterwards.
        services.AddScoped<IAIToolHandler, ProposeExerciseToolHandler>();
        services.AddScoped<IAIToolHandler, ProposeWorkoutToolHandler>();
        services.AddScoped<IAIToolHandler, ProposeWorkoutTemplateToolHandler>();
        services.AddScoped<IAIToolHandler, ProposeProgramPlanToolHandler>();
        services.AddScoped<IAIToolHandler, ProposeProgramUpdateToolHandler>();

        // Product feedback. Writes only to the admin backlog, so it needs no confirmation.
        services.AddScoped<IAIToolHandler, ReportUnsupportedRequestToolHandler>();

        return services;
    }
}
