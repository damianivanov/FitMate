using FitMate.Core.JsonModels.MuscleGroups;

namespace FitMate.Services.AI.Tools.ReadOnly;

/// <summary>
/// Turns the words users actually say ("arms", "push", "tricep") into muscle group ids. Doing this
/// on the server means the model never has to guess catalogue spellings.
/// </summary>
public static class MuscleGroupResolver
{
    /// <summary>Colloquial groupings expanded into the muscle words the catalogue uses.</summary>
    private static readonly Dictionary<string, string[]> Expansions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["arm"] = ["bicep", "tricep", "forearm"],
        ["upperarm"] = ["bicep", "tricep"],
        ["leg"] = ["quad", "hamstring", "glute", "calf"],
        ["lowerbody"] = ["quad", "hamstring", "glute", "calf"],
        ["upperbody"] = ["chest", "back", "shoulder", "bicep", "tricep"],
        ["push"] = ["chest", "shoulder", "tricep"],
        ["pull"] = ["back", "bicep"],
        ["core"] = ["ab", "oblique"],
        ["shoulder"] = ["shoulder", "delt"],
        ["cardio"] = ["cardio"],
    };

    /// <summary>Words that mean the same muscle but are spelled differently across catalogues.</summary>
    private static readonly Dictionary<string, string[]> Synonyms = new(StringComparer.OrdinalIgnoreCase)
    {
        ["bicep"] = ["bicep", "biceps"],
        ["tricep"] = ["tricep", "triceps"],
        ["quad"] = ["quad", "quadricep", "thigh"],
        ["hamstring"] = ["hamstring", "ham"],
        ["glute"] = ["glute", "buttock"],
        ["calf"] = ["calf", "calve"],
        ["ab"] = ["ab", "abdominal", "core", "stomach"],
        ["delt"] = ["delt", "deltoid", "shoulder"],
        ["lat"] = ["lat", "latissimus", "back"],
        ["pec"] = ["pec", "pectoral", "chest"],
        ["forearm"] = ["forearm", "grip"],
    };

    public static List<long> Resolve(
        IReadOnlyList<MuscleGroupModel> muscleGroups,
        IReadOnlyList<string>? focus,
        IReadOnlyList<long>? explicitIds)
    {
        var resolved = new HashSet<long>(explicitIds ?? []);

        foreach (var term in focus ?? [])
        {
            foreach (var word in Expand(term))
            {
                foreach (var group in muscleGroups.Where(group => Matches(group.Name, word)))
                {
                    resolved.Add(group.Id);
                }
            }
        }

        return [.. resolved];
    }

    /// <summary>Expands a single term into every catalogue word worth matching against.</summary>
    private static IEnumerable<string> Expand(string term)
    {
        var normalized = Normalize(term);
        if (normalized.Length == 0)
        {
            yield break;
        }

        var seeds = Expansions.TryGetValue(Singularize(normalized), out var expanded)
            ? expanded
            : [normalized];

        foreach (var seed in seeds)
        {
            yield return seed;

            var key = Singularize(seed);
            if (Synonyms.TryGetValue(key, out var synonyms))
            {
                foreach (var synonym in synonyms)
                {
                    yield return synonym;
                }
            }
        }
    }

    /// <summary>Substring match on normalized text, so "triceps" finds "Triceps Brachii".</summary>
    private static bool Matches(string groupName, string word)
    {
        var name = Normalize(groupName);
        var needle = Singularize(Normalize(word));

        return name.Contains(needle, StringComparison.OrdinalIgnoreCase)
            || Singularize(name).Contains(needle, StringComparison.OrdinalIgnoreCase);
    }

    private static string Normalize(string value) =>
        new(value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    private static string Singularize(string value) =>
        value.Length > 3 && value.EndsWith('s') ? value[..^1] : value;
}
