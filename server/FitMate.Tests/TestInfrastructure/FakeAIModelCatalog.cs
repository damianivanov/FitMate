using FitMate.Integrations.AI.Abstractions;

namespace FitMate.Tests.TestInfrastructure;

public class FakeAIModelCatalog : IAIModelCatalog
{
    public List<string> Models { get; set; } = [];

    public Exception? ThrowOnList { get; set; }

    public Task<IReadOnlyList<string>> ListModelsAsync(CancellationToken cancellationToken = default)
    {
        if (ThrowOnList != null)
        {
            throw ThrowOnList;
        }

        return Task.FromResult<IReadOnlyList<string>>(Models);
    }
}
