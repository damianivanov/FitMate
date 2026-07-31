using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Services.AIActions;

/// <summary>
/// Turns a confirmed proposal into real data. Executors must go through the normal domain services
/// so every existing rule — ownership, validation, subscription limits — still applies.
/// </summary>
public interface IAIActionExecutor
{
    AIActionType ActionType { get; }

    Task<AIActionResultModel> ExecuteAsync(AIAction action, long userId, CancellationToken cancellationToken);
}
