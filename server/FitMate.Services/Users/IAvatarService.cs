using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.Users;

/// <summary>
/// Owns the signed-in user's profile picture. Uploads follow the same direct-to-storage flow the
/// exercise images use: the browser asks for a short-lived write URL, PUTs the bytes straight to
/// blob storage, then confirms so the server validates and normalizes what actually arrived.
/// </summary>
public interface IAvatarService
{
    Task<ImageUploadTicketModel> CreateUploadTicketAsync(ImageUploadTicketRequest request);

    /// <summary>Validates the staged bytes, stores the finalized avatar and points the user at it.</summary>
    Task ConfirmUploadAsync(ConfirmImageUploadRequest request);

    /// <summary>Clears the avatar, deleting the stored blob when the user owns one.</summary>
    Task RemoveAsync();
}
