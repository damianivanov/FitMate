using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace FitMate.Services.Storage.Imaging;

public class ImageSharpImageProcessor : IImageProcessor
{
    private const int MaxEdge = 1200;
    private const int JpegQuality = 80;

    public async Task<ProcessedImage?> ProcessAsync(Stream input)
    {
        try
        {
            using var image = await Image.LoadAsync(input);

            if (image.Width > MaxEdge || image.Height > MaxEdge)
            {
                image.Mutate(context => context.Resize(new ResizeOptions
                {
                    Mode = ResizeMode.Max,
                    Size = new Size(MaxEdge, MaxEdge),
                }));
            }

            var hasAlpha = image.PixelType.AlphaRepresentation is not (null or PixelAlphaRepresentation.None);

            var output = new MemoryStream();
            if (hasAlpha)
            {
                await image.SaveAsPngAsync(output, new PngEncoder());
                output.Position = 0;
                return new ProcessedImage(output, "image/png", "png");
            }

            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = JpegQuality });
            output.Position = 0;
            return new ProcessedImage(output, "image/jpeg", "jpg");
        }
        catch (UnknownImageFormatException)
        {
            return null;
        }
        catch (InvalidImageContentException)
        {
            return null;
        }
    }
}
