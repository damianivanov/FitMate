namespace FitMate.Services.Storage.Blobs;

public enum StorageModule
{
    Exercises,
}

public static class StorageModuleExtensions
{
    public static string ToFolder(this StorageModule module) => module switch
    {
        StorageModule.Exercises => "exercises",
        _ => throw new ArgumentOutOfRangeException(nameof(module)),
    };
}
