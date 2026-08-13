using FitMate.Services.Storage.Blobs;

namespace FitMate.Services.Users;

/// <summary>
/// The facts about how a profile picture is stored and served, in one place: the service that
/// writes it and the service that hands its URL to the client both read them from here.
/// </summary>
public static class AvatarStorage
{
    public const StorageModule Module = StorageModule.Users;

    /// <summary>
    /// One derivative is enough: the avatar is drawn at 36-56 px, so 256 px still covers a 3x
    /// display, and a second size would double the stored bytes for a difference nobody can see.
    /// </summary>
    public const int SizePx = 256;

    /// <summary>
    /// Avatars are served through a signed URL that is regenerated on every request, so a short
    /// expiry would mean a fresh URL — and a fresh download — on every page load. A day-long
    /// window keeps the URL identical for half a day at a time, which is what lets the browser
    /// and the service worker's image cache actually hold on to it.
    /// </summary>
    public static readonly TimeSpan UrlLifetime = TimeSpan.FromHours(24);
}
