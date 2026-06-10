using FitMate.Services.Storage.Urls;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakePhotoUrlResolver : IPhotoUrlResolver
{
    public Task<string?> ResolveAsync(string? value) => Task.FromResult(value);
}
