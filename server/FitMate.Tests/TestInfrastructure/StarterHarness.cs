using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>
/// Wires an <see cref="AIRunStarter"/> over a real database with fake quota and entitlements, so
/// enqueue behaviour can be asserted without a provider or a worker.
/// </summary>
public sealed class StarterHarness
{
    private StarterHarness(
        AIRunStarter starter,
        AppDbContext context,
        FakeAICompletionProvider provider,
        FakeUsageService usage,
        FakeEntitlementService entitlements,
        long conversationId)
    {
        Starter = starter;
        Context = context;
        Provider = provider;
        Usage = usage;
        Entitlements = entitlements;
        ConversationId = conversationId;
    }

    public AIRunStarter Starter { get; }
    public AppDbContext Context { get; }
    public FakeAICompletionProvider Provider { get; }
    public FakeUsageService Usage { get; }
    public FakeEntitlementService Entitlements { get; }
    public long ConversationId { get; }

    public static async Task<StarterHarness> CreateAsync(SqliteTestDatabase db, AppDbContext? existingContext = null)
    {
        var context = existingContext ?? db.CreateContext();
        var conversationService = new AIConversationService(context, new AIRedactionService());

        var conversation = await conversationService.CreateAsync(
            new CreateAIConversationRequest(),
            SqliteTestDatabase.UserId);

        var usage = new FakeUsageService();
        var entitlements = new FakeEntitlementService();
        var provider = new FakeAICompletionProvider();

        var starter = new AIRunStarter(
            context,
            conversationService,
            new FakeAIBudgetResolver(),
            entitlements,
            usage,
            new AIProgressService(context),
            new AIPromptBuilder(),
            Options.Create(new AIOptions { Provider = "OpenAI", DefaultModel = "test-model" }));

        return new StarterHarness(starter, context, provider, usage, entitlements, conversation.Id);
    }
}
