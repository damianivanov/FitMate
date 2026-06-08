namespace FitMate.Services.Storage.Imaging;

public sealed record ProcessedImage(Stream Content, string ContentType, string Extension);

public interface IImageProcessor
{
    Task<ProcessedImage?> ProcessAsync(Stream input);
}
