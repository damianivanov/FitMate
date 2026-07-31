using FitMate.Core.JsonModels.AdminAI;
using FitMate.DB.Enums;
using FitMate.Services.AI.Unsupported;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class UnsupportedRequestServiceTests
{
    private static RecordUnsupportedRequestRequest Request(
        string functionality,
        string category = "integration") => new()
    {
        Category = category,
        RequestedFunctionality = functionality,
        UserIntentSummary = "User wants to sync data.",
        SuggestedFallback = "Log workouts manually.",
        ConversationId = 1,
        MessageId = 2,
    };

    // Различните формулировки дават един и същ ключ
    [Theory]
    [InlineData("Import my Apple Health workouts.", "import apple health workouts")]
    [InlineData("  IMPORT  my Apple-Health workouts!!! ", "import apple health workouts")]
    [InlineData("Can you please import my apple health workouts?", "import apple health workouts")]
    public void Normalize_ProducesStableKey(string input, string expected)
    {
        Assert.Equal(expected, UnsupportedRequestKeyNormalizer.Normalize(input));
    }

    // Текст само от пунктуация пак получава ключ
    [Fact]
    public void Normalize_PunctuationOnly_FallsBackToOriginal()
    {
        Assert.False(string.IsNullOrWhiteSpace(UnsupportedRequestKeyNormalizer.Normalize("???")));
    }

    // Първият доклад създава група с едно събитие
    [Fact]
    public async Task Record_FirstReport_CreatesGroupWithOneOccurrence()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        var id = await service.RecordAsync(
            Request("Import my Apple Health workouts."),
            SqliteTestDatabase.UserId);

        var group = await context.UnsupportedAIRequests.AsNoTracking().SingleAsync(x => x.Id == id);

        Assert.Equal(1, group.OccurrenceCount);
        Assert.Equal(UnsupportedRequestStatus.New, group.Status);
        Assert.Equal("import apple health workouts", group.NormalizedKey);
        Assert.Equal(group.FirstRequestedAt, group.LastRequestedAt);
        Assert.Equal(
            1,
            await context.UnsupportedAIRequestOccurrences.CountAsync(x => x.UnsupportedAIRequestId == id));
    }

    // Сходни формулировки се сливат в една група
    [Fact]
    public async Task Record_SimilarPhrasing_GroupsIntoOneRow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        var first = await service.RecordAsync(
            Request("Import my Apple Health workouts."),
            SqliteTestDatabase.UserId);
        var second = await service.RecordAsync(
            Request("Can you please import my Apple-Health workouts?"),
            SqliteTestDatabase.OtherUserId);

        Assert.Equal(first, second);
        var group = await context.UnsupportedAIRequests.AsNoTracking().SingleAsync();
        Assert.Equal(2, group.OccurrenceCount);
        Assert.True(group.LastRequestedAt >= group.FirstRequestedAt);
        Assert.Equal(2, await context.UnsupportedAIRequestOccurrences.CountAsync());
    }

    // Друга категория е отделна група
    [Fact]
    public async Task Record_DifferentCategory_CreatesSeparateGroup()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        await service.RecordAsync(
            Request("Import my Apple Health workouts.", "integration"),
            SqliteTestDatabase.UserId);
        await service.RecordAsync(
            Request("Import my Apple Health workouts.", "nutrition"),
            SqliteTestDatabase.UserId);

        Assert.Equal(2, await context.UnsupportedAIRequests.CountAsync());
    }

    // Нов доклад не нулира състоянието, зададено от админ
    [Fact]
    public async Task Record_KeepsAdminStatus()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);
        var id = await service.RecordAsync(
            Request("Import my Apple Health workouts."),
            SqliteTestDatabase.UserId);

        var group = await context.UnsupportedAIRequests.SingleAsync(x => x.Id == id);
        group.Status = UnsupportedRequestStatus.Planned;
        await context.SaveChangesAsync();

        await service.RecordAsync(
            Request("Import my Apple Health workouts."),
            SqliteTestDatabase.OtherUserId);

        var reloaded = await context.UnsupportedAIRequests.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(UnsupportedRequestStatus.Planned, reloaded.Status);
        Assert.Equal(2, reloaded.OccurrenceCount);
    }

    // Празна функционалност се отхвърля
    [Fact]
    public async Task Record_EmptyFunctionality_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        await Assert.ThrowsAsync<Core.Exceptions.FitMateException>(() =>
            service.RecordAsync(Request("   "), SqliteTestDatabase.UserId));
    }
}
