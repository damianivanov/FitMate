using FitMate.Services.Storage.Imaging;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeImageProcessor : IImageProcessor
{
    public ProcessedImage? Result { get; set; } =
        new(new MemoryStream([1, 2, 3]), "image/jpeg", "jpg");

    /// <summary>The size the last <see cref="ProcessSquareAsync"/> call asked for.</summary>
    public int? RequestedSquareSize { get; private set; }

    public Task<ProcessedImage?> ProcessAsync(Stream input) => Task.FromResult(Result);

    public Task<ProcessedImage?> ProcessSquareAsync(Stream input, int size)
    {
        RequestedSquareSize = size;
        return Task.FromResult(Result);
    }
}
