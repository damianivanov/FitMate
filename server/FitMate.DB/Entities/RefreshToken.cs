using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class RefreshToken : BaseTrackUserEntity
{
    public long UserId { get; set; }
    public string Value { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }

    public User User { get; set; } = null!;
}
