using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class Error : BaseTrackUserEntity
{
    public string? Source { get; set; }
    public string? Action { get; set; }
    public string RequestUrl { get; set; } = string.Empty;
    public string? UserAgent { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
}
