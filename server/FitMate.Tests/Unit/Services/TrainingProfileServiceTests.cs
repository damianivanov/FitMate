using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB.Enums;
using FitMate.Services.TrainingProfiles;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class TrainingProfileServiceTests
{
    private static SaveTrainingProfileRequest NewRequest() => new()
    {
        Goal = TrainingGoal.Hypertrophy,
        ExperienceLevel = TrainingExperienceLevel.Intermediate,
        PreferredTrainingDaysPerWeek = 4,
        PreferredWorkoutDurationMinutes = 60,
        WeightUnit = WeightUnit.Kg,
        AvailableEquipment = ["Barbell", "Dumbbell"],
        PreferredTrainingDays = [DayOfWeek.Monday, DayOfWeek.Thursday],
        ExerciseRestrictions = "No overhead pressing",
        AllowAIPersonalization = true,
    };

    // GET без запазен профил връща null
    [Fact]
    public async Task GetAsync_NoProfile_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        Assert.Null(await service.GetAsync(SqliteTestDatabase.UserId));
    }

    // Save създава профил и GET го връща с десериализирани списъци
    [Fact]
    public async Task SaveAsync_CreatesProfile_AndGetRoundtripsLists()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);
        var model = await service.GetAsync(SqliteTestDatabase.UserId);

        Assert.NotNull(model);
        Assert.Equal(TrainingGoal.Hypertrophy, model!.Goal);
        Assert.Equal(4, model.PreferredTrainingDaysPerWeek);
        Assert.Equal(["Barbell", "Dumbbell"], model.AvailableEquipment);
        Assert.Equal([DayOfWeek.Monday, DayOfWeek.Thursday], model.PreferredTrainingDays);
        Assert.Equal("No overhead pressing", model.ExerciseRestrictions);
    }

    // Повторен Save обновява същия ред (upsert, не дублира)
    [Fact]
    public async Task SaveAsync_Twice_UpdatesSingleRow()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);

        var update = NewRequest();
        update.Goal = TrainingGoal.Strength;
        update.AvailableEquipment = [];
        var model = await service.SaveAsync(update, SqliteTestDatabase.UserId);

        Assert.Equal(TrainingGoal.Strength, model.Goal);
        Assert.Empty(model.AvailableEquipment);
        Assert.Equal(1, await context.UserTrainingProfiles.CountAsync());
    }

    // Профилите са по един на потребител, но различни потребители имат отделни
    [Fact]
    public async Task SaveAsync_TwoUsers_TwoIndependentProfiles()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);
        var other = NewRequest();
        other.Goal = TrainingGoal.FatLoss;
        await service.SaveAsync(other, SqliteTestDatabase.OtherUserId);

        Assert.Equal(2, await context.UserTrainingProfiles.CountAsync());
        Assert.Equal(TrainingGoal.FatLoss, (await service.GetAsync(SqliteTestDatabase.OtherUserId))!.Goal);
        Assert.Equal(TrainingGoal.Hypertrophy, (await service.GetAsync(SqliteTestDatabase.UserId))!.Goal);
    }

    // Валидация на дни/седмица и продължителност
    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public async Task SaveAsync_DaysPerWeekOutOfRange_Throws(int days)
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        var request = NewRequest();
        request.PreferredTrainingDaysPerWeek = days;

        await Assert.ThrowsAsync<FitMateException>(() => service.SaveAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task SaveAsync_InvalidDuration_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        var request = NewRequest();
        request.PreferredWorkoutDurationMinutes = 5;

        await Assert.ThrowsAsync<FitMateException>(() => service.SaveAsync(request, SqliteTestDatabase.UserId));
    }

    // Липсваща продължителност е валидна (полето е по избор)
    [Fact]
    public async Task SaveAsync_NullDuration_IsAllowed()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        var request = NewRequest();
        request.PreferredWorkoutDurationMinutes = null;

        var model = await service.SaveAsync(request, SqliteTestDatabase.UserId);

        Assert.Null(model.PreferredWorkoutDurationMinutes);
    }
}
