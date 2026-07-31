using FitMate.Core.Settings;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI;

public class AIModelRouter : IAIModelRouter
{
    private readonly AIOptions options;

    public AIModelRouter(IOptions<AIOptions> options)
    {
        this.options = options.Value;
    }

    public string ResolveCompletionModel() => options.DefaultModel;

    public string ResolveVisionModel() =>
        string.IsNullOrWhiteSpace(options.VisionModel) ? options.DefaultModel : options.VisionModel;

    public string ResolveImageModel() =>
        string.IsNullOrWhiteSpace(options.ImageModel) ? options.DefaultModel : options.ImageModel;
}
