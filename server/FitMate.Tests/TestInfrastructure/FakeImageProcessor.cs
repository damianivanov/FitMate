using FitMate.Services.Storage.Imaging;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeImageProcessor : IImageProcessor
{
    public ProcessedImage? Result { get; set; } =
        new(new MemoryStream([1, 2, 3]), "image/jpeg", "jpg");

    public Task<ProcessedImage?> ProcessAsync(Stream input) => Task.FromResult(Result);
}
