using FitMate.Services.TrainingProfiles;

namespace FitMate.Services.AI.Tools.ReadOnly;

public class GetTrainingProfileToolHandler : IAIToolHandler
{
    private readonly ITrainingProfileService trainingProfileService;

    public GetTrainingProfileToolHandler(ITrainingProfileService trainingProfileService)
    {
        this.trainingProfileService = trainingProfileService;
    }

    public string Name => "get_training_profile";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "The user's training profile: goal, experience level, weekly availability, session length, "
            + "weight unit, available equipment and any exercise restrictions.",
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var profile = await trainingProfileService.GetAsync(context.UserId);

        return profile == null
            ? AIToolExecutionResult.Ok(new { hasProfile = false })
            : AIToolExecutionResult.Ok(new { hasProfile = true, profile });
    }
}
