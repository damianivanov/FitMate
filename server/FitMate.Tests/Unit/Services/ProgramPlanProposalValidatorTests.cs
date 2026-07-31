using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;
using FitMate.Services.AIActions;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanProposalValidatorTests
{
    private static readonly DateOnly Start = new(2026, 1, 5);

    private static ProposeProgramPlanPayload ValidPayload() => new()
    {
        Name = "Upper/Lower",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = Start,
        EndDate = Start.AddDays(56),
        WorkoutsPerWeek = 2,
        Schedule =
        [
            new ProposedProgramScheduleItem
            {
                DayOfWeek = DayOfWeek.Monday,
                DayType = ProgramPlanDayType.Workout,
                ExistingWorkoutTemplateId = 10,
            },
            new ProposedProgramScheduleItem
            {
                DayOfWeek = DayOfWeek.Thursday,
                DayType = ProgramPlanDayType.Workout,
                NewWorkoutTemplateClientKey = "lower-a",
            },
        ],
        NewTemplates =
        [
            new ProposedProgramTemplate
            {
                ClientKey = "lower-a",
                Name = "Lower A",
                Exercises =
                [
                    new ProposedExercise
                    {
                        ExerciseId = 5,
                        Sets = [new ProposedSet { Reps = 8 }, new ProposedSet { Reps = 8 }],
                    },
                ],
            },
        ],
    };

    private static ProgramPlanProposalValidation Validate(
        ProposeProgramPlanPayload payload,
        int? maximumDurationMonths = null) =>
        ProgramPlanProposalValidator.Validate(payload, [10L], [5L], maximumDurationMonths);

    // Коректно предложение минава без грешки и без предупреждения
    [Fact]
    public void Validate_ValidPayload_HasNoErrorsOrWarnings()
    {
        var result = Validate(ValidPayload());

        Assert.Empty(result.Errors);
        Assert.Empty(result.Warnings);
    }

    // Календар по дати не може да се предлага от модела
    [Fact]
    public void Validate_CustomCalendar_IsRejected()
    {
        var payload = ValidPayload();
        payload.ScheduleType = ProgramScheduleType.CustomCalendar;

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("Custom calendars", StringComparison.Ordinal));
    }

    // Шаблон, който не е видим за потребителя, се отхвърля
    [Fact]
    public void Validate_UnknownTemplateId_IsRejected()
    {
        var payload = ValidPayload();
        payload.Schedule[0].ExistingWorkoutTemplateId = 999;

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("999", StringComparison.Ordinal));
    }

    // Ключ, за който няма предложен шаблон, се отхвърля
    [Fact]
    public void Validate_DanglingClientKey_IsRejected()
    {
        var payload = ValidPayload();
        payload.Schedule[1].NewWorkoutTemplateClientKey = "missing";

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("'missing'", StringComparison.Ordinal));
    }

    // Предложен, но неизползван шаблон е само предупреждение
    [Fact]
    public void Validate_UnusedTemplate_IsAWarning()
    {
        var payload = ValidPayload();
        payload.NewTemplates.Add(new ProposedProgramTemplate
        {
            ClientKey = "spare",
            Name = "Spare",
            Exercises = [new ProposedExercise { ExerciseId = 5, Sets = [new ProposedSet { Reps = 8 }] }],
        });

        var result = Validate(payload);

        Assert.Empty(result.Errors);
        Assert.Contains(result.Warnings, x => x.Contains("spare", StringComparison.Ordinal));
    }

    // Тренировъчен ден без шаблон се отхвърля
    [Fact]
    public void Validate_TrainingDayWithoutTemplate_IsRejected()
    {
        var payload = ValidPayload();
        payload.Schedule[0].ExistingWorkoutTemplateId = null;

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("needs a workout template", StringComparison.Ordinal));
    }

    // Ротацията иска индекси 1..N без дупки
    [Fact]
    public void Validate_RotationWithGap_IsRejected()
    {
        var payload = ValidPayload();
        payload.ScheduleType = ProgramScheduleType.Rotation;
        payload.Schedule[0].DayOfWeek = null;
        payload.Schedule[0].RotationDayIndex = 1;
        payload.Schedule[1].DayOfWeek = null;
        payload.Schedule[1].RotationDayIndex = 4;

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("1..N", StringComparison.Ordinal));
    }

    // Дублиран ден от седмицата се отхвърля
    [Fact]
    public void Validate_DuplicateWeekday_IsRejected()
    {
        var payload = ValidPayload();
        payload.Schedule[1].DayOfWeek = DayOfWeek.Monday;

        var result = Validate(payload);

        Assert.Contains(result.Errors, x => x.Contains("Duplicate weekday", StringComparison.Ordinal));
    }

    // Продължителност над позволената от абонамента се отхвърля
    [Fact]
    public void Validate_LongerThanEntitlement_IsRejected()
    {
        var payload = ValidPayload();
        payload.EndDate = Start.AddMonths(6);

        var result = Validate(payload, maximumDurationMonths: 1);

        Assert.Contains(result.Errors, x => x.Contains("at most 1 month", StringComparison.Ordinal));
    }

    // Четири поредни тренировъчни дни е предупреждение, не грешка
    [Fact]
    public void Validate_FourConsecutiveDays_IsAWarning()
    {
        var payload = ValidPayload();
        payload.WorkoutsPerWeek = 4;
        payload.Schedule =
        [
            .. new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday }
                .Select(day => new ProposedProgramScheduleItem
                {
                    DayOfWeek = day,
                    DayType = ProgramPlanDayType.Workout,
                    ExistingWorkoutTemplateId = 10,
                }),
        ];
        payload.NewTemplates.Clear();

        var result = Validate(payload);

        Assert.Empty(result.Errors);
        Assert.Contains(result.Warnings, x => x.Contains("4 consecutive", StringComparison.Ordinal));
    }

    // Несъответствие между бройката дни и workoutsPerWeek е предупреждение
    [Fact]
    public void Validate_WorkoutsPerWeekMismatch_IsAWarning()
    {
        var payload = ValidPayload();
        payload.WorkoutsPerWeek = 5;

        var result = Validate(payload);

        Assert.Empty(result.Errors);
        Assert.Contains(result.Warnings, x => x.Contains("2 training day", StringComparison.Ordinal));
    }
}
