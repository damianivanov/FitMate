namespace FitMate.Services.Storage.Imaging;

public sealed record ProcessedImage(Stream Content, string ContentType, string Extension);

public interface IImageProcessor
{
    Task<ProcessedImage?> ProcessAsync(Stream input);

    /// <summary>
    /// Centre-crops to a square and resizes it down to at most <paramref name="size"/> px per edge.
    /// Always encodes to JPEG over white — the result is drawn inside a circle, so transparency is
    /// never visible and would only cost bytes. Returns <c>null</c> when the input is not an image.
    /// </summary>
    Task<ProcessedImage?> ProcessSquareAsync(Stream input, int size);
}
