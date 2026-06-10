namespace FitMate.Core.JsonModels.Errors;

public class ErrorModel
{
    public long Id { get; set; }
    public string? Source { get; set; }
    public string? Action { get; set; }
    public string RequestUrl { get; set; } = string.Empty;
    public string? UserAgent { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public DateTime DateCreated { get; set; }
    public long? CreatedById { get; set; }
    public string? CreatedByEmail { get; set; }
}
