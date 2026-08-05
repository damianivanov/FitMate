using FitMate.Core.JsonModels.MuscleGroups;
using FitMate.Services.AI.Tools.ReadOnly;

namespace FitMate.Tests.Unit.Services;

public class MuscleGroupResolverTests
{
    private static readonly List<MuscleGroupModel> Catalogue =
    [
        new() { Id = 1, Name = "Chest" },
        new() { Id = 2, Name = "Back" },
        new() { Id = 3, Name = "Shoulders" },
        new() { Id = 4, Name = "Biceps" },
        new() { Id = 5, Name = "Triceps" },
        new() { Id = 6, Name = "Quadriceps" },
        new() { Id = 7, Name = "Hamstrings" },
        new() { Id = 8, Name = "Glutes" },
        new() { Id = 9, Name = "Calves" },
    ];

    // "Arms" се разгъва до бицепс и трицепс, а не до нищо
    [Fact]
    public void Arms_ExpandsToBicepsAndTriceps()
    {
        var resolved = MuscleGroupResolver.Resolve(Catalogue, ["arms"], null);

        Assert.Contains(4L, resolved);
        Assert.Contains(5L, resolved);
        Assert.DoesNotContain(1L, resolved);
    }

    // Единствено число, множествено число и главни букви сочат към една и съща група
    [Theory]
    [InlineData("tricep")]
    [InlineData("triceps")]
    [InlineData("TRICEPS")]
    [InlineData(" Triceps ")]
    public void SingularPluralAndCasing_ResolveToTheSameGroup(string term)
    {
        var resolved = MuscleGroupResolver.Resolve(Catalogue, [term], null);

        Assert.Equal(5L, Assert.Single(resolved));
    }

    // "Legs" покрива четирите долни групи
    [Fact]
    public void Legs_CoversEveryLowerBodyGroup()
    {
        var resolved = MuscleGroupResolver.Resolve(Catalogue, ["legs"], null);

        Assert.Equal([6L, 7L, 8L, 9L], resolved.OrderBy(id => id));
    }

    // "Push" и "pull" са тренировъчни групи, не мускули
    [Fact]
    public void PushAndPull_ExpandToTrainingSplits()
    {
        var push = MuscleGroupResolver.Resolve(Catalogue, ["push"], null);
        var pull = MuscleGroupResolver.Resolve(Catalogue, ["pull"], null);

        Assert.Equal([1L, 3L, 5L], push.OrderBy(id => id));
        Assert.Equal([2L, 4L], pull.OrderBy(id => id));
    }

    // Явно подадените идентификатори се запазват, дори без съвпадение по име
    [Fact]
    public void ExplicitIds_ArePreservedAndMerged()
    {
        var resolved = MuscleGroupResolver.Resolve(Catalogue, ["biceps"], [99L]);

        Assert.Contains(99L, resolved);
        Assert.Contains(4L, resolved);
    }

    // Непознат термин не връща произволна група
    [Fact]
    public void UnknownTerm_ResolvesToNothing()
    {
        Assert.Empty(MuscleGroupResolver.Resolve(Catalogue, ["banana"], null));
        Assert.Empty(MuscleGroupResolver.Resolve(Catalogue, null, null));
    }
}
