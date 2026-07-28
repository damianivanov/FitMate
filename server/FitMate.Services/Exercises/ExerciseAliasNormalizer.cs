using System.Text;

namespace FitMate.Services.Exercises;

/// <summary>
/// Canonical alias form used for lookups and AI exercise matching:
/// trim, lowercase, separators (whitespace/-/_) collapse to single spaces, all other punctuation stripped.
/// </summary>
public static class ExerciseAliasNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        var pendingSpace = false;

        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                if (pendingSpace && builder.Length > 0)
                {
                    builder.Append(' ');
                }

                builder.Append(character);
                pendingSpace = false;
                continue;
            }

            if (char.IsWhiteSpace(character) || character is '-' or '_')
            {
                pendingSpace = true;
            }

            // Any other punctuation is dropped entirely ("Fly's" -> "flys").
        }

        return builder.ToString();
    }
}
