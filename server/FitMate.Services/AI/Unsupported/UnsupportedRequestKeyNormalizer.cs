using System.Text;

namespace FitMate.Services.AI.Unsupported;

/// <summary>
/// Turns free text into a stable grouping key, so "Import my Apple Health workouts." and
/// "Can you please import my Apple-Health workouts?" land on the same backlog row.
/// </summary>
public static class UnsupportedRequestKeyNormalizer
{
    private const int MaxKeyLength = 500;
    private const int MaxCategoryLength = 100;

    private static readonly HashSet<string> FillerWords = new(StringComparer.Ordinal)
    {
        "the", "a", "an", "my", "me", "i", "to", "for", "of", "please", "can", "you",
        "could", "would", "want", "need", "help", "with", "on", "in", "do", "does",
    };

    public static string Normalize(string input) => Normalize(input, removeFillerWords: true);

    /// <summary>Categories keep their filler words: they are short labels, not sentences.</summary>
    public static string NormalizeCategory(string input)
    {
        var normalized = Normalize(input, removeFillerWords: false);
        return normalized.Length > MaxCategoryLength ? normalized[..MaxCategoryLength] : normalized;
    }

    private static string Normalize(string input, bool removeFillerWords)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(input.Length);
        foreach (var character in input.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
            }
            else if (char.IsWhiteSpace(character) || character is '-' or '_')
            {
                builder.Append(' ');
            }
        }

        var words = builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var kept = removeFillerWords
            ? words.Where(word => !FillerWords.Contains(word)).ToArray()
            : words;

        // A request made entirely of filler or punctuation still needs a key.
        if (kept.Length == 0)
        {
            kept = words.Length > 0 ? words : [input.Trim().ToLowerInvariant()];
        }

        var result = string.Join(' ', kept);
        return result.Length > MaxKeyLength ? result[..MaxKeyLength] : result;
    }
}
