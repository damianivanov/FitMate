namespace FitMate.Services.Storage.Blobs;

public enum StorageModule
{
    Exercises,
    Users,
}

public static class StorageModuleExtensions
{
    public static string ToFolder(this StorageModule module) => module switch
    {
        StorageModule.Exercises => "exercises",
        StorageModule.Users => "users",
        _ => throw new ArgumentOutOfRangeException(nameof(module)),
    };
}
