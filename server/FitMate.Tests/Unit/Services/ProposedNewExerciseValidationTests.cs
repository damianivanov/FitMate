using FitMate.Core.JsonModels.AIActions;
using FitMate.Services.AIActions;

namespace FitMate.Tests.Unit.Services;

public class ProposedNewExerciseValidationTests
{
    private static ProposedExercise ByKey(string key) => new()
    {
        NewExerciseClientKey = key,
        Sets = [new ProposedSet { Reps = 10 }],
    };

    private static ProposedNewExercise NewExercise(string key, string name = "Skull Crusher") => new()
    {
        ClientKey = key,
        Name = name,
        PrimaryMuscleGroupId = 5,
    };

    // Упражнение по ключ минава, когато ключът е описан в същото предложение
    [Fact]
    public void DeclaredKey_IsAccepted()
    {
        var errors = AIProposalValidator.ValidateExercises(
            [ByKey("skull-crusher")],
            [],
            ["skull-crusher"]);

        Assert.Empty(errors);
    }

    // Ключ, който не е описан, се отхвърля, вместо да се създаде мълчаливо
    [Fact]
    public void UndeclaredKey_IsRejected()
    {
        var errors = AIProposalValidator.ValidateExercises([ByKey("ghost")], [], []);

        Assert.Contains(errors, error => error.Contains("ghost"));
    }

    // Идентификатор и ключ едновременно е двусмислено и се отхвърля
    [Fact]
    public void IdAndKeyTogether_AreRejected()
    {
        var exercise = ByKey("skull-crusher");
        exercise.ExerciseId = 42;

        var errors = AIProposalValidator.ValidateExercises([exercise], [42], ["skull-crusher"]);

        Assert.Contains(errors, error => error.Contains("use one"));
    }

    // Един и същ нов ключ два пъти в списъка е дубликат
    [Fact]
    public void SameKeyTwice_IsADuplicate()
    {
        var errors = AIProposalValidator.ValidateExercises(
            [ByKey("skull-crusher"), ByKey("skull-crusher")],
            [],
            ["skull-crusher"]);

        Assert.Contains(errors, error => error.Contains("more than once"));
    }

    // Съществуващите упражнения продължават да минават през проверката за видимост
    [Fact]
    public void ExistingExercise_StillRequiresVisibility()
    {
        var visible = AIProposalValidator.ValidateExercises(
            [new ProposedExercise { ExerciseId = 7, Sets = [new ProposedSet { Reps = 8 }] }],
            [7]);

        var hidden = AIProposalValidator.ValidateExercises(
            [new ProposedExercise { ExerciseId = 7, Sets = [new ProposedSet { Reps = 8 }] }],
            []);

        Assert.Empty(visible);
        Assert.Contains(hidden, error => error.Contains("not available"));
    }

    // Новите упражнения се проверяват със същите правила като самостоятелно предложение
    [Fact]
    public void NewExercises_AreHeldToTheExerciseRules()
    {
        var missingKey = AIProposalValidator.ValidateNewExercises([NewExercise(string.Empty)]);
        var missingName = AIProposalValidator.ValidateNewExercises([NewExercise("k", string.Empty)]);
        var duplicated = AIProposalValidator.ValidateNewExercises([NewExercise("k"), NewExercise("K")]);
        var valid = AIProposalValidator.ValidateNewExercises([NewExercise("skull-crusher")]);

        Assert.Contains(missingKey, error => error.Contains("clientKey"));
        Assert.Contains(missingName, error => error.Contains("name"));
        Assert.Contains(duplicated, error => error.Contains("Duplicate"));
        Assert.Empty(valid);
    }
}
