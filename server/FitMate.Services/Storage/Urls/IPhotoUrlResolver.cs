namespace FitMate.Services.Storage.Urls;

public interface IPhotoUrlResolver
{
    Task<string?> ResolveAsync(string? value);
}
