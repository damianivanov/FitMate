using FitMate.Services.AIActions.Executors;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Services.AIActions;

public static class AIActionServiceCollectionExtensions
{
    /// <summary>
    /// The confirmation pipeline. Like the tool allow-list, executors are registered explicitly:
    /// an action type with no executor cannot be confirmed, which is the safe failure direction.
    /// </summary>
    public static IServiceCollection AddFitMateAIActions(this IServiceCollection services)
    {
        services.AddScoped<IAIActionService, AIActionService>();
        services.AddScoped<IAIProposalDetailService, AIProposalDetailService>();

        services.AddScoped<IAIActionExecutor, CreatePersonalExerciseActionExecutor>();
        services.AddScoped<IAIActionExecutor, CreateGlobalExerciseActionExecutor>();
        services.AddScoped<IAIActionExecutor, CreateWorkoutActionExecutor>();
        services.AddScoped<IAIActionExecutor, CreateWorkoutTemplateActionExecutor>();
        services.AddScoped<IAIActionExecutor, CreateProgramPlanActionExecutor>();
        services.AddScoped<IAIActionExecutor, UpdateProgramPlanActionExecutor>();

        return services;
    }
}
