namespace FitMate.Services.AI;

/// <summary>Resolves which configured model serves each kind of request.</summary>
public interface IAIModelRouter
{
    string ResolveCompletionModel();
    string ResolveVisionModel();
    string ResolveImageModel();
}
