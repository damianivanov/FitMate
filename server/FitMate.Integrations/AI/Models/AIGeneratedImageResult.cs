namespace FitMate.Integrations.AI.Models;

public class AIGeneratedImageResult
{
    public byte[] Content { get; set; } = [];
    public string ContentType { get; set; } = "image/png";
    public string Model { get; set; } = string.Empty;
    public string? ProviderRequestId { get; set; }
}
