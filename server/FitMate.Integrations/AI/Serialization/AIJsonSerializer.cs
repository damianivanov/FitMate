using System.Text.Json;
using System.Text.Json.Serialization;

namespace FitMate.Integrations.AI.Serialization;

/// <summary>
/// Shared JSON settings for everything that crosses the AI boundary (tool arguments, tool results,
/// structured model output).
/// </summary>
public static class AIJsonSerializer
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static T? Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options);

    /// <summary>
    /// Models sometimes wrap JSON in markdown fences. Strips them before parsing.
    /// </summary>
    public static string StripCodeFences(string value)
    {
        var trimmed = value.Trim();
        if (!trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            return trimmed;
        }

        var firstNewLine = trimmed.IndexOf('\n');
        if (firstNewLine < 0)
        {
            return trimmed;
        }

        var withoutOpening = trimmed[(firstNewLine + 1)..];
        var closing = withoutOpening.LastIndexOf("```", StringComparison.Ordinal);
        return (closing < 0 ? withoutOpening : withoutOpening[..closing]).Trim();
    }
}
