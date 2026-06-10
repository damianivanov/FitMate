using FitMate.DB.Entities;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.TestInfrastructure;

public class SqliteTestDatabaseTests
{
    // Базата засява трима потребители и три мускулни групи
    [Fact]
    public async Task EnsureCreated_SeedsUsersAndMuscleGroups()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        Assert.Equal(3, await context.Users.CountAsync());
        Assert.Equal(3, await context.MuscleGroups.CountAsync());
        Assert.True(await context.MuscleGroups.AnyAsync(x => x.Id == SqliteTestDatabase.ChestId));
    }

    // Различни контексти споделят една и съща база
    [Fact]
    public async Task SeparateContexts_ShareTheSameInMemoryDatabase()
    {
        using var db = new SqliteTestDatabase();

        await using (var write = db.CreateContext())
        {
            write.Exercises.Add(new Exercise
            {
                Name = "Bench Press",
                Slug = "bench-press",
                IsPublic = true,
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            });
            await write.SaveChangesAsync();
        }

        await using var read = db.CreateContext();
        Assert.True(await read.Exercises.AnyAsync(x => x.Slug == "bench-press"));
    }

    // Транзакциите се поддържат и комитнатото се запазва
    [Fact]
    public async Task Transactions_AreSupported()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        await using var transaction = await context.Database.BeginTransactionAsync();
        context.Exercises.Add(new Exercise
        {
            Name = "Squat",
            Slug = "squat",
            PrimaryMuscleGroupId = SqliteTestDatabase.LegsId,
        });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();

        Assert.True(await context.Exercises.AnyAsync(x => x.Slug == "squat"));
    }

    // Невалиден външен ключ хвърля DbUpdateException
    [Fact]
    public async Task ForeignKeys_AreEnforced()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        context.Exercises.Add(new Exercise
        {
            Name = "Orphan",
            Slug = "orphan",
            PrimaryMuscleGroupId = 999,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }
}
