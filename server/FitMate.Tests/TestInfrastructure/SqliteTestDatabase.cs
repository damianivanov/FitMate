using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.TestInfrastructure;

public sealed class SqliteTestDatabase : IDisposable
{
    public const long UserId = 1;
    public const long OtherUserId = 2;
    public const long AdminUserId = 3;

    public const long ChestId = 1;
    public const long BackId = 2;
    public const long LegsId = 3;

    private readonly SqliteConnection connection;
    private readonly DbContextOptions<AppDbContext> options;

    public SqliteTestDatabase()
    {
        connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        using var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        Seed(context);
    }

    public AppDbContext CreateContext() => new(options);

    private static void Seed(AppDbContext context)
    {
        context.Users.AddRange(
            NewUser(UserId, "user@test.local"),
            NewUser(OtherUserId, "other@test.local"),
            NewUser(AdminUserId, "admin@test.local"));

        context.MuscleGroups.AddRange(
            new MuscleGroup { Id = ChestId, Name = "Chest" },
            new MuscleGroup { Id = BackId, Name = "Back" },
            new MuscleGroup { Id = LegsId, Name = "Legs" });

        context.SaveChanges();
    }

    private static User NewUser(long id, string email) => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        UserName = email,
        NormalizedUserName = email.ToUpperInvariant(),
        FirstName = "Test",
        LastName = $"User{id}",
    };

    public void Dispose() => connection.Dispose();
}
