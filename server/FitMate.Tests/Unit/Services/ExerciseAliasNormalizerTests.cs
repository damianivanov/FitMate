using FitMate.Services.Exercises;

namespace FitMate.Tests.Unit.Services;

public class ExerciseAliasNormalizerTests
{
    [Theory]
    [InlineData("  Bench   Press ", "bench press")]
    [InlineData("Pull-Up", "pull up")]
    [InlineData("pull_up", "pull up")]
    [InlineData("Skullcrushers!!!", "skullcrushers")]
    [InlineData("DB Fly's", "db flys")]
    [InlineData("Overhead Press (OHP)", "overhead press ohp")]
    [InlineData("BENCH PRESS", "bench press")]
    public void Normalize_ProducesCanonicalForm(string input, string expected)
    {
        Assert.Equal(expected, ExerciseAliasNormalizer.Normalize(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("!!!")]
    public void Normalize_EmptyInputs_ReturnEmptyString(string? input)
    {
        Assert.Equal(string.Empty, ExerciseAliasNormalizer.Normalize(input));
    }
}
