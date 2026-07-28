# Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users subscribe to Plus/Pro through Stripe Checkout, manage billing through the Stripe Customer Portal, and the Stripe webhook — not the success redirect — authoritatively maintains `UserSubscription` state and invalidates the entitlement cache.

**Architecture:** New `BillingCustomer` + `BillingWebhookEvent` entities in FitMate.DB; a provider-neutral `IBillingProvider` / `IBillingWebhookVerifier` abstraction in `FitMate.Integrations/Billing` with the only Stripe.net-touching code in `FitMate.Integrations/Billing/Stripe`; `BillingService` in FitMate.Services owns checkout/portal session creation, redirect-origin validation and the insert-first idempotent webhook pipeline that upserts Plan 04's `UserSubscription` and calls `IEntitlementService.InvalidateAsync`. `BillingController` (`api/billing`) exposes plans/me/checkout-session/customer-portal-session plus an `[AllowAnonymous]` raw-body webhook endpoint.

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), Stripe.net NuGet (isolated in FitMate.Integrations), xUnit, React 19 + axios frontend, Reinforced.Typings type export.

**Depends on:** Plan 04 (`Plan`, `PlanPrice`, `PlanEntitlement`, `UserSubscription`, `SubscriptionStatus`, `BillingInterval`, `SubscriptionFeature`, `IEntitlementService` must exist). Plan 04's plan file is not written at the time this plan was authored — every touchpoint below carries a "verify at execution time" note against the actual Plan 04 code.

## Global Constraints

- Follow repo conventions (roadmap D4): services take `(request, long userId)` and **no CancellationToken**; the ONLY exception is `FitMate.Integrations` provider interfaces which DO take `CancellationToken` (network calls). Services call providers with `CancellationToken.None`.
- Provider neutrality (roadmap D6): **no Stripe SDK types outside `server/FitMate.Integrations`**. Services/controllers consume only `IBillingProvider`, `IBillingWebhookVerifier` and their neutral models. Parsing the raw webhook JSON with `System.Text.Json` in `BillingService` is allowed (it uses no SDK types).
- **Webhook is authoritative** (spec non-negotiable): the checkout success redirect must NOT create or activate anything. Only webhook events mutate `UserSubscription`.
- Webhook idempotency: INSERT `BillingWebhookEvent` first; a unique-violation on `(Provider, ExternalEventId)` means already-received → return success without reprocessing.
- Controllers extend `BaseApiController(ILogger<BaseApiController>, AppDbContext, IUserService)` and use `this.ReturnJson(...)` / `this.ReturnJsonError(...)` — except the webhook action, which returns bare `Ok()` / `BadRequest()` status codes for Stripe and never leaks error details.
- Business/validation errors throw `FitMateException` (`FitMate.Core/Exceptions/FitMateException.cs`) — `LogApiErrorAttribute` converts it to a 400 envelope.
- DTOs in `FitMate.Core/JsonModels/Billing/`; enums in `FitMate.DB/Enums`; entity configs in `FitMate.DB/Configurations`; DbSets as expression-bodied properties in `AppDbContext`; `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- `Stripe:SecretKey` and `Stripe:WebhookSecret` come from environment only (empty placeholders in appsettings.json). **Decision:** `Stripe:AllowedRedirectOrigins` is not secret, so it ships localhost dev defaults in appsettings.json; production values come from env/deployment config. Startup validation (`ValidateOnStart`) fails the app in Production when either secret is missing or the origins list is empty.
- After backend DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` regenerates `client/src/types/backend.ts`, then `npm run process-types` in `client/`. Never write TS interfaces for API models by hand.
- After any React/TypeScript change: `cd client && npm run lint && npx tsc -b --noEmit` must pass.
- Frontend async code uses `async/await` only — never `.then()/.catch()/.finally()` chains.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.

## File Structure

```
server/FitMate.DB/
├── Enums/BillingWebhookStatus.cs                                  (Task 1)
├── Entities/BillingCustomer.cs, BillingWebhookEvent.cs            (Task 1)
├── Configurations/BillingCustomerConfiguration.cs,
│                  BillingWebhookEventConfiguration.cs             (Task 1)
├── AppDbContext.cs (modify: 2 DbSets)                             (Task 1)
└── Migrations/xxx_AddStripeBillingEntities.cs (generated)         (Task 1)

server/FitMate.Integrations/                                       (Task 2 — created if Plan 05 has not run)
├── FitMate.Integrations.csproj
└── Billing/
    ├── Abstractions/IBillingProvider.cs, IBillingWebhookVerifier.cs,
    │                BillingWebhookSignatureException.cs
    ├── Abstractions/Models/BillingCheckoutRequest.cs, BillingWebhookEnvelope.cs
    └── Stripe/StripeOptions.cs, StripeBillingProvider.cs,
               StripeWebhookVerifier.cs, StripeServiceCollectionExtensions.cs

server/FitMate.Core/JsonModels/Billing/
├── BillingPlanModel.cs, BillingPlanPriceModel.cs,
│   BillingPlanEntitlementModel.cs, MySubscriptionModel.cs,
│   CreateCheckoutSessionRequest.cs, CreateCustomerPortalSessionRequest.cs,
│   BillingRedirectModel.cs                                        (Task 3)

server/FitMate.Services/Subscriptions/
├── IEntitlementService.cs (modify: + InvalidateAsync)             (Task 4)
└── EntitlementService.cs  (modify: implement InvalidateAsync)     (Task 4)

server/FitMate.Services/Billing/
├── IBillingService.cs                                             (Task 5)
├── BillingService.cs                                              (Tasks 5–8)
└── BillingWebhookOutcome.cs                                       (Task 5)

server/FitMate.Web/
├── Controllers/BillingController.cs                               (Task 9)
├── Program.cs (modify: DI + AddFitMateStripe)                     (Task 9)
└── appsettings.json (modify: Stripe section)                      (Task 9)

server/FitMate.Tests/
├── Unit/Database/BillingEntityConstraintTests.cs                  (Task 1)
├── Unit/Services/StripeWebhookVerifierTests.cs                    (Task 2)
├── Unit/Services/BillingTestData.cs                               (Task 5)
├── Unit/Services/BillingServiceTests.cs                           (Tasks 5–6)
├── Unit/Services/BillingServiceWebhookTests.cs                    (Tasks 7–8)
├── TestInfrastructure/FakeBillingProvider.cs                      (Task 5)
├── TestInfrastructure/FakeBillingWebhookVerifier.cs               (Task 5)
├── TestInfrastructure/FakeEntitlementService.cs                   (Task 5)
└── Integration/BillingApiTests.cs                                 (Task 10)

client/src/
├── services/billingService.ts                                     (Task 11)
├── types/index.ts (modify: re-exports)                            (Task 11)
├── pages/Subscription/{Subscription.tsx, index.ts,
│     hooks/useSubscriptionPage.ts, components/CurrentPlanCard.tsx,
│     components/CheckoutResult.tsx}                               (Tasks 11–12)
├── pages/SubscriptionPlans/{SubscriptionPlans.tsx, index.ts,
│     hooks/useSubscriptionPlansPage.ts, components/PlanCard.tsx}  (Task 12)
└── routes.tsx (modify: /subscription routes)                      (Task 12)
```

---

### Task 1: Entities, enum, EF configuration, migration

**Files:**
- Create: `server/FitMate.DB/Enums/BillingWebhookStatus.cs`
- Create: `server/FitMate.DB/Entities/BillingCustomer.cs`, `server/FitMate.DB/Entities/BillingWebhookEvent.cs`
- Create: `server/FitMate.DB/Configurations/BillingCustomerConfiguration.cs`, `server/FitMate.DB/Configurations/BillingWebhookEventConfiguration.cs`
- Modify: `server/FitMate.DB/AppDbContext.cs` (2 DbSets)
- Test: `server/FitMate.Tests/Unit/Database/BillingEntityConstraintTests.cs`

**Interfaces:**
- Consumes: `BaseEntity`, `User` entity, Plan 04's migration chain (its migration must already exist in `server/FitMate.DB/Migrations`; if it does not, STOP — this plan depends on Plan 04).
- Produces: the two entities + enum exactly as below; the webhook pipeline (Task 7) relies on the unique index `(Provider, ExternalEventId)`.

- [ ] **Step 1: Write the enum** (`server/FitMate.DB/Enums/BillingWebhookStatus.cs`)

```csharp
namespace FitMate.DB.Enums;

public enum BillingWebhookStatus
{
    Received = 1,
    Processed = 2,
    Failed = 3,
    Ignored = 4,
}
```

- [ ] **Step 2: Write the entities**

`server/FitMate.DB/Entities/BillingCustomer.cs`:

```csharp
using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class BillingCustomer : BaseEntity
{
    public long UserId { get; set; }
    public string Provider { get; set; } = "Stripe";
    public string ExternalCustomerId { get; set; } = string.Empty;

    public User User { get; set; } = null!;
}
```

`server/FitMate.DB/Entities/BillingWebhookEvent.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class BillingWebhookEvent : BaseEntity
{
    public string Provider { get; set; } = "Stripe";
    public string ExternalEventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public BillingWebhookStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
```

- [ ] **Step 3: Write the configurations** (same style as `RefreshTokenConfiguration.cs`)

`server/FitMate.DB/Configurations/BillingCustomerConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class BillingCustomerConfiguration : IEntityTypeConfiguration<BillingCustomer>
{
    public void Configure(EntityTypeBuilder<BillingCustomer> builder)
    {
        builder.Property(x => x.Provider).HasMaxLength(50).IsRequired();
        builder.Property(x => x.ExternalCustomerId).HasMaxLength(255).IsRequired();

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.UserId, x.Provider }).IsUnique();
        builder.HasIndex(x => new { x.Provider, x.ExternalCustomerId }).IsUnique();
    }
}
```

`server/FitMate.DB/Configurations/BillingWebhookEventConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class BillingWebhookEventConfiguration : IEntityTypeConfiguration<BillingWebhookEvent>
{
    public void Configure(EntityTypeBuilder<BillingWebhookEvent> builder)
    {
        builder.Property(x => x.Provider).HasMaxLength(50).IsRequired();
        builder.Property(x => x.ExternalEventId).HasMaxLength(255).IsRequired();
        builder.Property(x => x.EventType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.PayloadJson).IsRequired();
        builder.Property(x => x.ErrorMessage).HasMaxLength(2000);

        builder.HasIndex(x => new { x.Provider, x.ExternalEventId }).IsUnique();
        builder.HasIndex(x => x.Status);
    }
}
```

In `server/FitMate.DB/AppDbContext.cs` add after the last existing DbSet (Plan 04 will have added `Plans`, `PlanPrices`, `UserSubscriptions` etc. — keep theirs, append these):

```csharp
    public DbSet<BillingCustomer> BillingCustomers => Set<BillingCustomer>();
    public DbSet<BillingWebhookEvent> BillingWebhookEvents => Set<BillingWebhookEvent>();
```

(Configurations are picked up automatically via `ApplyConfigurationsFromAssembly` in `OnModelCreating` — no registration needed.)

- [ ] **Step 4: Write failing constraint test** (`server/FitMate.Tests/Unit/Database/BillingEntityConstraintTests.cs`) — the idempotency design of Task 7 depends on this index actually existing:

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Database;

public class BillingEntityConstraintTests
{
    [Fact]
    public async Task BillingWebhookEvent_DuplicateProviderAndExternalEventId_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        context.BillingWebhookEvents.Add(new BillingWebhookEvent
        {
            Provider = "Stripe",
            ExternalEventId = "evt_1",
            EventType = "invoice.paid",
            PayloadJson = "{}",
            Status = BillingWebhookStatus.Received,
            ReceivedAt = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();

        context.BillingWebhookEvents.Add(new BillingWebhookEvent
        {
            Provider = "Stripe",
            ExternalEventId = "evt_1",
            EventType = "invoice.paid",
            PayloadJson = "{}",
            Status = BillingWebhookStatus.Received,
            ReceivedAt = DateTime.UtcNow,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task BillingCustomer_DuplicateUserAndProvider_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        context.BillingCustomers.Add(new BillingCustomer
        {
            UserId = SqliteTestDatabase.UserId,
            Provider = "Stripe",
            ExternalCustomerId = "cus_1",
        });
        await context.SaveChangesAsync();

        context.BillingCustomers.Add(new BillingCustomer
        {
            UserId = SqliteTestDatabase.UserId,
            Provider = "Stripe",
            ExternalCustomerId = "cus_2",
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingEntityConstraintTests`
Expected: PASS (2 tests). Also run `--filter AppDbContextTests` to confirm the model is still valid for Sqlite `EnsureCreated`.

- [ ] **Step 6: Add migration**

Run: `dotnet ef migrations add AddStripeBillingEntities --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: migration adds 2 tables with both unique indexes; no drops/renames of existing tables. Inspect the generated file.

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.DB server/FitMate.Tests
git commit -m "feat(billing): BillingCustomer and BillingWebhookEvent entities with migration"
```

---

### Task 2: FitMate.Integrations billing abstractions + Stripe implementation

**Files:**
- Create (only if Plan 05 has not already created the project): `server/FitMate.Integrations/FitMate.Integrations.csproj`
- Create: `server/FitMate.Integrations/Billing/Abstractions/IBillingProvider.cs`, `IBillingWebhookVerifier.cs`, `BillingWebhookSignatureException.cs`
- Create: `server/FitMate.Integrations/Billing/Abstractions/Models/BillingCheckoutRequest.cs`, `BillingWebhookEnvelope.cs`
- Create: `server/FitMate.Integrations/Billing/Stripe/StripeOptions.cs`, `StripeBillingProvider.cs`, `StripeWebhookVerifier.cs`, `StripeServiceCollectionExtensions.cs`
- Modify: `server/FitMate.Services/FitMate.Services.csproj` (project reference)
- Test: `server/FitMate.Tests/Unit/Services/StripeWebhookVerifierTests.cs`

**Interfaces:**
- Consumes: nothing from FitMate (self-contained integration layer).
- Produces (canonical — Tasks 5–10 and Plan 05's project layout rely on these exact names):

```csharp
namespace FitMate.Integrations.Billing.Abstractions;

public interface IBillingProvider
{
    Task<string> CreateCheckoutSessionUrlAsync(BillingCheckoutRequest request, CancellationToken ct);
    Task<string> CreateCustomerPortalUrlAsync(string externalCustomerId, string returnUrl, CancellationToken ct);
    Task<string> EnsureCustomerAsync(long userId, string email, CancellationToken ct);
}

public interface IBillingWebhookVerifier
{
    /// Verifies the provider signature over the RAW request body and returns a neutral envelope.
    /// Throws BillingWebhookSignatureException on invalid signature or missing webhook secret.
    BillingWebhookEnvelope VerifyAndParse(string payloadJson, string signatureHeader);
}
```

- [ ] **Step 1: Create the project if missing** (skip if Plan 05 already created `server/FitMate.Integrations` — then only add the `Billing/` folder to it)

```bash
dotnet new classlib -o server/FitMate.Integrations -n FitMate.Integrations -f net9.0
dotnet sln server/FitMate.sln add server/FitMate.Integrations/FitMate.Integrations.csproj
dotnet add server/FitMate.Integrations/FitMate.Integrations.csproj package Stripe.net
dotnet add server/FitMate.Integrations/FitMate.Integrations.csproj package Microsoft.Extensions.Options.ConfigurationExtensions
dotnet add server/FitMate.Integrations/FitMate.Integrations.csproj package Microsoft.Extensions.Hosting.Abstractions
dotnet add server/FitMate.Services/FitMate.Services.csproj reference server/FitMate.Integrations/FitMate.Integrations.csproj
```

Delete the template `Class1.cs`. Verify the target framework matches the other projects (open `server/FitMate.Services/FitMate.Services.csproj` at execution time; use its `<TargetFramework>` value).

- [ ] **Step 2: Write the abstractions**

`Billing/Abstractions/Models/BillingCheckoutRequest.cs`:

```csharp
namespace FitMate.Integrations.Billing.Abstractions;

public class BillingCheckoutRequest
{
    public string ExternalCustomerId { get; set; } = string.Empty;
    public string ExternalPriceId { get; set; } = string.Empty;
    public string SuccessUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
    public string ClientReferenceId { get; set; } = string.Empty;
}
```

`Billing/Abstractions/Models/BillingWebhookEnvelope.cs`:

```csharp
namespace FitMate.Integrations.Billing.Abstractions;

public class BillingWebhookEnvelope
{
    public string ExternalEventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
}
```

`Billing/Abstractions/BillingWebhookSignatureException.cs`:

```csharp
namespace FitMate.Integrations.Billing.Abstractions;

public class BillingWebhookSignatureException : Exception
{
    public BillingWebhookSignatureException(string message)
        : base(message)
    {
    }

    public BillingWebhookSignatureException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
```

`IBillingProvider.cs` and `IBillingWebhookVerifier.cs` exactly as in the Interfaces block above.

- [ ] **Step 3: Write the Stripe implementation**

`Billing/Stripe/StripeOptions.cs`:

```csharp
namespace FitMate.Integrations.Billing.Stripe;

public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string[] AllowedRedirectOrigins { get; set; } = [];
}
```

`Billing/Stripe/StripeWebhookVerifier.cs`:

```csharp
using FitMate.Integrations.Billing.Abstractions;
using Microsoft.Extensions.Options;
using Stripe;

namespace FitMate.Integrations.Billing.Stripe;

public class StripeWebhookVerifier : IBillingWebhookVerifier
{
    private readonly StripeOptions options;

    public StripeWebhookVerifier(IOptions<StripeOptions> options)
    {
        this.options = options.Value;
    }

    public BillingWebhookEnvelope VerifyAndParse(string payloadJson, string signatureHeader)
    {
        // A missing secret must fail closed: never accept an unverifiable webhook.
        if (string.IsNullOrWhiteSpace(options.WebhookSecret))
        {
            throw new BillingWebhookSignatureException("Stripe webhook secret is not configured.");
        }

        try
        {
            var stripeEvent = EventUtility.ConstructEvent(
                payloadJson,
                signatureHeader,
                options.WebhookSecret,
                throwOnApiVersionMismatch: false);

            return new BillingWebhookEnvelope
            {
                ExternalEventId = stripeEvent.Id,
                EventType = stripeEvent.Type,
                PayloadJson = payloadJson,
            };
        }
        catch (StripeException ex)
        {
            throw new BillingWebhookSignatureException("Stripe webhook signature verification failed.", ex);
        }
    }
}
```

`Billing/Stripe/StripeBillingProvider.cs` (verify exact Stripe.net class/option names against the installed package version at execution time — this is the current Stripe.net surface):

```csharp
using FitMate.Integrations.Billing.Abstractions;
using Microsoft.Extensions.Options;
using Stripe;

namespace FitMate.Integrations.Billing.Stripe;

public class StripeBillingProvider : IBillingProvider
{
    private readonly StripeClient client;

    public StripeBillingProvider(IOptions<StripeOptions> options)
    {
        client = new StripeClient(options.Value.SecretKey);
    }

    public async Task<string> EnsureCustomerAsync(long userId, string email, CancellationToken ct)
    {
        var customerService = new CustomerService(client);
        var customer = await customerService.CreateAsync(
            new CustomerCreateOptions
            {
                Email = email,
                Metadata = new Dictionary<string, string> { ["fitmate_user_id"] = userId.ToString() },
            },
            cancellationToken: ct);
        return customer.Id;
    }

    public async Task<string> CreateCheckoutSessionUrlAsync(BillingCheckoutRequest request, CancellationToken ct)
    {
        var sessionService = new global::Stripe.Checkout.SessionService(client);
        var session = await sessionService.CreateAsync(
            new global::Stripe.Checkout.SessionCreateOptions
            {
                Mode = "subscription",
                Customer = request.ExternalCustomerId,
                ClientReferenceId = request.ClientReferenceId,
                LineItems =
                [
                    new global::Stripe.Checkout.SessionLineItemOptions
                    {
                        Price = request.ExternalPriceId,
                        Quantity = 1,
                    },
                ],
                SuccessUrl = request.SuccessUrl,
                CancelUrl = request.CancelUrl,
            },
            cancellationToken: ct);
        return session.Url;
    }

    public async Task<string> CreateCustomerPortalUrlAsync(string externalCustomerId, string returnUrl, CancellationToken ct)
    {
        var sessionService = new global::Stripe.BillingPortal.SessionService(client);
        var session = await sessionService.CreateAsync(
            new global::Stripe.BillingPortal.SessionCreateOptions
            {
                Customer = externalCustomerId,
                ReturnUrl = returnUrl,
            },
            cancellationToken: ct);
        return session.Url;
    }
}
```

`Billing/Stripe/StripeServiceCollectionExtensions.cs`:

```csharp
using FitMate.Integrations.Billing.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FitMate.Integrations.Billing.Stripe;

public static class StripeServiceCollectionExtensions
{
    public static IServiceCollection AddFitMateStripe(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<StripeOptions>()
            .Bind(configuration.GetSection(StripeOptions.SectionName))
            .Validate<IHostEnvironment>((options, environment) =>
                !environment.IsProduction()
                    || (!string.IsNullOrWhiteSpace(options.SecretKey)
                        && !string.IsNullOrWhiteSpace(options.WebhookSecret)
                        && options.AllowedRedirectOrigins.Length > 0),
                "Stripe:SecretKey, Stripe:WebhookSecret and Stripe:AllowedRedirectOrigins must be configured in production.")
            .ValidateOnStart();

        services.AddScoped<IBillingProvider, StripeBillingProvider>();
        services.AddScoped<IBillingWebhookVerifier, StripeWebhookVerifier>();
        return services;
    }
}
```

- [ ] **Step 4: Write verifier tests** (`server/FitMate.Tests/Unit/Services/StripeWebhookVerifierTests.cs`). Stripe signatures are plain HMAC-SHA256 over `"{timestamp}.{payload}"`, so a valid signature can be produced locally — no network:

```csharp
using System.Security.Cryptography;
using System.Text;
using FitMate.Integrations.Billing.Abstractions;
using FitMate.Integrations.Billing.Stripe;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class StripeWebhookVerifierTests
{
    private const string Secret = "whsec_test_secret";
    private const string Payload =
        """{"id":"evt_test_1","object":"event","type":"invoice.paid","data":{"object":{}}}""";

    private static StripeWebhookVerifier CreateVerifier(string secret = Secret) =>
        new(Options.Create(new StripeOptions { WebhookSecret = secret }));

    private static string SignatureHeader(string payload, string secret, long timestamp)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}.{payload}"));
        var signature = Convert.ToHexString(hash).ToLowerInvariant();
        return $"t={timestamp},v1={signature}";
    }

    [Fact]
    public void ValidSignature_ReturnsEnvelope()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var verifier = CreateVerifier();

        var envelope = verifier.VerifyAndParse(Payload, SignatureHeader(Payload, Secret, timestamp));

        Assert.Equal("evt_test_1", envelope.ExternalEventId);
        Assert.Equal("invoice.paid", envelope.EventType);
        Assert.Equal(Payload, envelope.PayloadJson);
    }

    [Fact]
    public void WrongSecret_Throws()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var verifier = CreateVerifier();

        Assert.Throws<BillingWebhookSignatureException>(() =>
            verifier.VerifyAndParse(Payload, SignatureHeader(Payload, "whsec_wrong", timestamp)));
    }

    [Fact]
    public void GarbageHeader_Throws()
    {
        var verifier = CreateVerifier();

        Assert.Throws<BillingWebhookSignatureException>(() =>
            verifier.VerifyAndParse(Payload, "t=123,v1=deadbeef"));
    }

    [Fact]
    public void MissingSecret_ThrowsInsteadOfAccepting()
    {
        var verifier = CreateVerifier(secret: "");

        Assert.Throws<BillingWebhookSignatureException>(() =>
            verifier.VerifyAndParse(Payload, "t=123,v1=deadbeef"));
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter StripeWebhookVerifierTests`
Expected: PASS (4 tests). If `ValidSignature_ReturnsEnvelope` fails on tolerance or parsing, check the `EventUtility.ConstructEvent` overload parameters of the installed Stripe.net version.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Integrations server/FitMate.Services server/FitMate.Tests server/FitMate.sln
git commit -m "feat(billing): FitMate.Integrations billing abstractions and Stripe provider"
```

---

### Task 3: Billing DTOs (JsonModels)

**Files:**
- Create: `server/FitMate.Core/JsonModels/Billing/BillingPlanModel.cs`, `BillingPlanPriceModel.cs`, `BillingPlanEntitlementModel.cs`, `MySubscriptionModel.cs`, `CreateCheckoutSessionRequest.cs`, `CreateCustomerPortalSessionRequest.cs`, `BillingRedirectModel.cs`

**Interfaces:**
- Consumes: Plan 04 enums `SubscriptionStatus`, `BillingInterval`, `SubscriptionFeature` from `FitMate.DB.Enums`.
- Produces: the seven DTOs below. Tasks 5–9 and the frontend (generated `JsonModels.Billing.*` types) use these names.

- [ ] **Step 1: Write the DTOs** (namespace `FitMate.Core.JsonModels.Billing`; one class per file)

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Billing;

public class BillingPlanModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsCurrent { get; set; }
    public List<BillingPlanPriceModel> Prices { get; set; } = [];
    public List<BillingPlanEntitlementModel> Entitlements { get; set; } = [];
}

public class BillingPlanPriceModel
{
    public long Id { get; set; }
    public BillingInterval Interval { get; set; }
    public int AmountCents { get; set; }
    public string Currency { get; set; } = string.Empty;
}

public class BillingPlanEntitlementModel
{
    public SubscriptionFeature Feature { get; set; }
    public int? Limit { get; set; }
}

public class MySubscriptionModel
{
    public bool HasSubscription { get; set; }
    public long? PlanId { get; set; }
    public string? PlanName { get; set; }
    public SubscriptionStatus? Status { get; set; }
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public class CreateCheckoutSessionRequest
{
    public long PlanPriceId { get; set; }
    public string SuccessUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
}

public class CreateCustomerPortalSessionRequest
{
    public string ReturnUrl { get; set; } = string.Empty;
}

public class BillingRedirectModel
{
    public string Url { get; set; } = string.Empty;
}
```

> Verify at execution time against Plan 04's entities: `BillingPlanPriceModel.AmountCents`/`Currency`/`Interval` must mirror `PlanPrice`'s actual money/interval property names, and `BillingPlanEntitlementModel.Limit` must mirror `PlanEntitlement`'s limit property (`server/FitMate.DB/Entities/PlanPrice.cs`, `PlanEntitlement.cs`). Rename here to match — do NOT invent parallel names.

- [ ] **Step 2: Build**

Run: `dotnet build server/FitMate.sln`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add server/FitMate.Core
git commit -m "feat(billing): billing DTOs"
```

---

### Task 4: Entitlement cache invalidation hook

**Files:**
- Modify: `server/FitMate.Services/Subscriptions/IEntitlementService.cs`, `server/FitMate.Services/Subscriptions/EntitlementService.cs`

> Verify the actual folder/file names delivered by Plan 04 at execution time (roadmap says `IEntitlementService` lives in FitMate.Services; the feature folder is expected to be `Subscriptions`). If Plan 04 already added `InvalidateAsync`, verify the signature matches and skip this task.

**Interfaces:**
- Consumes: Plan 04's `IEntitlementService` / `EntitlementService`.
- Produces the canonical signature the webhook pipeline (Task 8) calls:

```csharp
Task InvalidateAsync(long userId);
```

- [ ] **Step 1: Add to the interface**

```csharp
    /// Drops any cached entitlement/usage data for the user. Called by billing webhooks
    /// after subscription state changes so the next entitlement check sees the new plan.
    Task InvalidateAsync(long userId);
```

- [ ] **Step 2: Implement in `EntitlementService`** — inspect Plan 04's caching. Expected shape (Plan 04 registers `IMemoryCache` — `AddMemoryCache()` already exists in Program.cs):

```csharp
    public Task InvalidateAsync(long userId)
    {
        memoryCache.Remove(EntitlementCacheKey(userId));
        return Task.CompletedTask;
    }
```

Use Plan 04's actual cache-key helper/constant. If Plan 04's `EntitlementService` turns out to have no cache, implement as a no-op (`return Task.CompletedTask;`) with a comment — the contract must exist either way so caching can be added without touching billing.

- [ ] **Step 3: Build + run Plan 04's entitlement tests**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter EntitlementServiceTests`
Expected: build OK, existing tests PASS. (If a Plan 04 fake implements `IEntitlementService`, add the new member there too.)

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(billing): IEntitlementService.InvalidateAsync cache invalidation hook"
```

---

### Task 5: BillingService — plans and current subscription (TDD)

**Files:**
- Create: `server/FitMate.Services/Billing/IBillingService.cs`, `server/FitMate.Services/Billing/BillingService.cs`
- Create: `server/FitMate.Tests/TestInfrastructure/FakeBillingProvider.cs`
- Create: `server/FitMate.Tests/Unit/Services/BillingTestData.cs`
- Test: `server/FitMate.Tests/Unit/Services/BillingServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 entities, Task 2 abstractions, Task 3 DTOs, Plan 04's `Plan`/`PlanPrice`/`UserSubscription` entities + DbSets (`dbContext.Plans`, `dbContext.PlanPrices`, `dbContext.UserSubscriptions` — verify DbSet names in `AppDbContext.cs` at execution time).
- Produces (full interface — later tasks add no signatures, only implementations):

```csharp
using FitMate.Core.JsonModels.Billing;

namespace FitMate.Services.Billing;

public interface IBillingService
{
    Task<IReadOnlyList<BillingPlanModel>> GetPlansAsync(long userId);
    Task<MySubscriptionModel> GetMySubscriptionAsync(long userId);
    Task<BillingRedirectModel> CreateCheckoutSessionAsync(CreateCheckoutSessionRequest request, long userId);
    Task<BillingRedirectModel> CreateCustomerPortalSessionAsync(CreateCustomerPortalSessionRequest request, long userId);
    Task<BillingWebhookOutcome> ProcessWebhookAsync(string payloadJson, string signatureHeader);
}
```

(`BillingWebhookOutcome` is created in this task — Step 4 below defines the complete enum so the interface compiles; Task 7 only consumes it.)

- [ ] **Step 1: Write shared test infrastructure**

`server/FitMate.Tests/TestInfrastructure/FakeBillingProvider.cs`:

```csharp
using FitMate.Integrations.Billing.Abstractions;

namespace FitMate.Tests.TestInfrastructure;

public class FakeBillingProvider : IBillingProvider
{
    public List<BillingCheckoutRequest> CheckoutRequests { get; } = [];
    public List<(string ExternalCustomerId, string ReturnUrl)> PortalRequests { get; } = [];
    public List<(long UserId, string Email)> EnsuredCustomers { get; } = [];
    public string NextCustomerId { get; set; } = "cus_test_1";

    public Task<string> CreateCheckoutSessionUrlAsync(BillingCheckoutRequest request, CancellationToken ct)
    {
        CheckoutRequests.Add(request);
        return Task.FromResult("https://checkout.stripe.test/c/cs_test_123");
    }

    public Task<string> CreateCustomerPortalUrlAsync(string externalCustomerId, string returnUrl, CancellationToken ct)
    {
        PortalRequests.Add((externalCustomerId, returnUrl));
        return Task.FromResult("https://billing.stripe.test/p/session_123");
    }

    public Task<string> EnsureCustomerAsync(long userId, string email, CancellationToken ct)
    {
        EnsuredCustomers.Add((userId, email));
        return Task.FromResult(NextCustomerId);
    }
}
```

`server/FitMate.Tests/Unit/Services/BillingTestData.cs` (seed helpers for Plan 04 entities — verify property names against Plan 04's actual `Plan`/`PlanPrice` classes at execution time and adjust the initializers, keeping StripePriceId/IsActive/IsPublic semantics):

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public static class BillingTestData
{
    public static async Task<(long PlanId, long PlanPriceId)> SeedPlanAsync(
        SqliteTestDatabase db,
        string stripePriceId = "price_plus_monthly",
        bool planIsPublic = true,
        bool planIsActive = true,
        bool priceIsActive = true)
    {
        await using var context = db.CreateContext();
        var plan = new Plan { Name = "Plus", IsPublic = planIsPublic, IsActive = planIsActive };
        context.Plans.Add(plan);
        await context.SaveChangesAsync();

        var price = new PlanPrice
        {
            PlanId = plan.Id,
            StripePriceId = stripePriceId,
            IsActive = priceIsActive,
            AmountCents = 499,
            Currency = "eur",
            Interval = BillingInterval.Monthly,
        };
        context.PlanPrices.Add(price);
        await context.SaveChangesAsync();
        return (plan.Id, price.Id);
    }

    public static async Task SeedBillingCustomerAsync(
        SqliteTestDatabase db, long userId, string externalCustomerId)
    {
        await using var context = db.CreateContext();
        context.BillingCustomers.Add(new BillingCustomer
        {
            UserId = userId,
            Provider = "Stripe",
            ExternalCustomerId = externalCustomerId,
        });
        await context.SaveChangesAsync();
    }
}
```

- [ ] **Step 2: Write failing tests** (`server/FitMate.Tests/Unit/Services/BillingServiceTests.cs`)

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Billing;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.Billing.Stripe;
using FitMate.Services.Billing;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class BillingServiceTests
{
    private static (BillingService Service, FakeBillingProvider Provider, FakeBillingWebhookVerifier Verifier, FakeEntitlementService Entitlements)
        CreateService(SqliteTestDatabase db)
    {
        var provider = new FakeBillingProvider();
        var verifier = new FakeBillingWebhookVerifier();
        var entitlements = new FakeEntitlementService();
        var options = Options.Create(new StripeOptions
        {
            AllowedRedirectOrigins = ["https://app.fitmate.test", "http://localhost:5273"],
        });
        var service = new BillingService(db.CreateContext(), provider, verifier, options, entitlements);
        return (service, provider, verifier, entitlements);
    }

    [Fact]
    public async Task GetPlans_ReturnsPublicActivePlansWithActivePrices()
    {
        using var db = new SqliteTestDatabase();
        var (planId, priceId) = await BillingTestData.SeedPlanAsync(db);
        await BillingTestData.SeedPlanAsync(db, stripePriceId: "price_hidden", planIsPublic: false);
        var (service, _, _, _) = CreateService(db);

        var plans = await service.GetPlansAsync(SqliteTestDatabase.UserId);

        var plan = Assert.Single(plans);
        Assert.Equal(planId, plan.Id);
        Assert.False(plan.IsCurrent);
        var price = Assert.Single(plan.Prices);
        Assert.Equal(priceId, price.Id);
        Assert.Equal(499, price.AmountCents);
    }

    [Fact]
    public async Task GetPlans_MarksCurrentPlan()
    {
        using var db = new SqliteTestDatabase();
        var (planId, _) = await BillingTestData.SeedPlanAsync(db);
        await using (var context = db.CreateContext())
        {
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = planId,
                Status = SubscriptionStatus.Active,
            });
            await context.SaveChangesAsync();
        }
        var (service, _, _, _) = CreateService(db);

        var plans = await service.GetPlansAsync(SqliteTestDatabase.UserId);

        Assert.True(Assert.Single(plans).IsCurrent);
    }

    [Fact]
    public async Task GetMySubscription_NoSubscription_ReturnsHasSubscriptionFalse()
    {
        using var db = new SqliteTestDatabase();
        var (service, _, _, _) = CreateService(db);

        var model = await service.GetMySubscriptionAsync(SqliteTestDatabase.UserId);

        Assert.False(model.HasSubscription);
        Assert.Null(model.Status);
    }

    [Fact]
    public async Task GetMySubscription_ReturnsPlanAndRenewal()
    {
        using var db = new SqliteTestDatabase();
        var (planId, _) = await BillingTestData.SeedPlanAsync(db);
        var periodEnd = new DateTime(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc);
        await using (var context = db.CreateContext())
        {
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = planId,
                Status = SubscriptionStatus.Active,
                CurrentPeriodEnd = periodEnd,
                CancelAtPeriodEnd = true,
            });
            await context.SaveChangesAsync();
        }
        var (service, _, _, _) = CreateService(db);

        var model = await service.GetMySubscriptionAsync(SqliteTestDatabase.UserId);

        Assert.True(model.HasSubscription);
        Assert.Equal(planId, model.PlanId);
        Assert.Equal("Plus", model.PlanName);
        Assert.Equal(SubscriptionStatus.Active, model.Status);
        Assert.Equal(periodEnd, model.CurrentPeriodEnd);
        Assert.True(model.CancelAtPeriodEnd);
    }
}
```

> `FakeBillingWebhookVerifier` and `FakeEntitlementService` are created in Tasks 7/8. To keep this task self-contained, create both files NOW with the minimal shapes given in Tasks 7/8 (they are pure fakes with no logic dependencies).

- [ ] **Step 3: Run tests — expect FAIL** (`BillingService` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceTests`

- [ ] **Step 4: Implement** `IBillingService` (Interfaces block above) and `BillingWebhookOutcome` (`server/FitMate.Services/Billing/BillingWebhookOutcome.cs` — this is the final enum; Task 7 consumes it as-is):

```csharp
namespace FitMate.Services.Billing;

public enum BillingWebhookOutcome
{
    InvalidSignature = 1,
    Processed = 2,
    AlreadyProcessed = 3,
    Ignored = 4,
    Failed = 5,
}
```

`server/FitMate.Services/Billing/BillingService.cs` (query/plan methods now; checkout/portal/webhook methods throw `NotImplementedException` until Tasks 6–8):

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Billing;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.Billing.Abstractions;
using FitMate.Integrations.Billing.Stripe;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.Billing;

public class BillingService : IBillingService
{
    private const string StripeProviderName = "Stripe";

    private readonly AppDbContext dbContext;
    private readonly IBillingProvider billingProvider;
    private readonly IBillingWebhookVerifier webhookVerifier;
    private readonly StripeOptions stripeOptions;
    private readonly IEntitlementService entitlementService;

    public BillingService(
        AppDbContext dbContext,
        IBillingProvider billingProvider,
        IBillingWebhookVerifier webhookVerifier,
        IOptions<StripeOptions> stripeOptions,
        IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.billingProvider = billingProvider;
        this.webhookVerifier = webhookVerifier;
        this.stripeOptions = stripeOptions.Value;
        this.entitlementService = entitlementService;
    }

    public async Task<IReadOnlyList<BillingPlanModel>> GetPlansAsync(long userId)
    {
        var plans = await dbContext.Plans
            .AsNoTracking()
            .Include(p => p.Prices)
            .Include(p => p.Entitlements)
            .Where(p => p.IsPublic && p.IsActive)
            .OrderBy(p => p.Id)
            .ToListAsync();

        var currentPlanId = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId
                && (s.Status == SubscriptionStatus.Active
                    || s.Status == SubscriptionStatus.Trialing
                    || s.Status == SubscriptionStatus.PastDue))
            .Select(s => (long?)s.PlanId)
            .FirstOrDefaultAsync();

        return plans.Select(p => new BillingPlanModel
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            IsCurrent = p.Id == currentPlanId,
            Prices = p.Prices
                .Where(price => price.IsActive)
                .OrderBy(price => price.AmountCents)
                .Select(price => new BillingPlanPriceModel
                {
                    Id = price.Id,
                    Interval = price.Interval,
                    AmountCents = price.AmountCents,
                    Currency = price.Currency,
                })
                .ToList(),
            Entitlements = p.Entitlements
                .Select(e => new BillingPlanEntitlementModel { Feature = e.Feature, Limit = e.Limit })
                .ToList(),
        }).ToList();
    }

    public async Task<MySubscriptionModel> GetMySubscriptionAsync(long userId)
    {
        var subscription = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (subscription == null)
        {
            return new MySubscriptionModel { HasSubscription = false };
        }

        return new MySubscriptionModel
        {
            HasSubscription = true,
            PlanId = subscription.PlanId,
            PlanName = subscription.Plan?.Name,
            Status = subscription.Status,
            CurrentPeriodStart = subscription.CurrentPeriodStart,
            CurrentPeriodEnd = subscription.CurrentPeriodEnd,
            CancelAtPeriodEnd = subscription.CancelAtPeriodEnd,
            CancelledAt = subscription.CancelledAt,
        };
    }

    public Task<BillingRedirectModel> CreateCheckoutSessionAsync(CreateCheckoutSessionRequest request, long userId)
        => throw new NotImplementedException(); // Task 6

    public Task<BillingRedirectModel> CreateCustomerPortalSessionAsync(CreateCustomerPortalSessionRequest request, long userId)
        => throw new NotImplementedException(); // Task 6

    public Task<BillingWebhookOutcome> ProcessWebhookAsync(string payloadJson, string signatureHeader)
        => throw new NotImplementedException(); // Tasks 7–8
}
```

> Verify at execution time against Plan 04: navigation names `Plan.Prices`, `Plan.Entitlements`, `UserSubscription.Plan`, property names `PlanPrice.AmountCents/Currency/Interval/StripePriceId/IsActive`, `PlanEntitlement.Feature/Limit`, `UserSubscription.CurrentPeriodStart/End/CancelAtPeriodEnd/CancelledAt/ExternalSubscriptionId`, and the `SubscriptionStatus` members (`Active`, `Trialing`, `PastDue`, `Cancelled`, `Incomplete`, `Paused` are assumed below) in `server/FitMate.DB/Entities` and `server/FitMate.DB/Enums`. Adjust this plan's code to the real names — never the other way around.

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceTests`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(billing): BillingService plans and current-subscription queries"
```

---

### Task 6: BillingService — checkout and customer portal sessions (TDD)

**Files:**
- Modify: `server/FitMate.Services/Billing/BillingService.cs`
- Test: `server/FitMate.Tests/Unit/Services/BillingServiceTests.cs` (append)

**Interfaces:**
- Consumes: `IBillingProvider`, `StripeOptions.AllowedRedirectOrigins`, `FitMateException`.
- Produces: working `CreateCheckoutSessionAsync` / `CreateCustomerPortalSessionAsync` (signatures unchanged from Task 5).

Rules:
1. `SuccessUrl`/`CancelUrl`/`ReturnUrl` must be absolute http(s) URLs whose origin is in `AllowedRedirectOrigins` — reject arbitrary domains (open-redirect guard).
2. Checkout: `PlanPriceId` must reference an **active** price on an **active, public** plan with a non-empty `StripePriceId`.
3. Checkout ensures a `BillingCustomer` row (creating the Stripe customer via `IBillingProvider.EnsureCustomerAsync` on first use), passes `StripePriceId` and `ClientReferenceId = userId`.
4. Portal requires an **existing** `BillingCustomer` — never creates one (a user with no billing history has nothing to manage).
5. Checkout/portal never touch `UserSubscription` — the webhook is authoritative.

- [ ] **Step 1: Append failing tests to `BillingServiceTests.cs`**

```csharp
    private static CreateCheckoutSessionRequest CheckoutRequest(long planPriceId) => new()
    {
        PlanPriceId = planPriceId,
        SuccessUrl = "https://app.fitmate.test/subscription/success",
        CancelUrl = "https://app.fitmate.test/subscription/cancel",
    };

    [Fact]
    public async Task Checkout_CreatesBillingCustomerAndReturnsSessionUrl()
    {
        using var db = new SqliteTestDatabase();
        var (_, priceId) = await BillingTestData.SeedPlanAsync(db);
        var (service, provider, _, _) = CreateService(db);

        var result = await service.CreateCheckoutSessionAsync(CheckoutRequest(priceId), SqliteTestDatabase.UserId);

        Assert.Equal("https://checkout.stripe.test/c/cs_test_123", result.Url);
        var checkout = Assert.Single(provider.CheckoutRequests);
        Assert.Equal("price_plus_monthly", checkout.ExternalPriceId);
        Assert.Equal(SqliteTestDatabase.UserId.ToString(), checkout.ClientReferenceId);
        Assert.Equal("cus_test_1", checkout.ExternalCustomerId);
        var ensured = Assert.Single(provider.EnsuredCustomers);
        Assert.Equal(SqliteTestDatabase.UserId, ensured.UserId);

        await using var context = db.CreateContext();
        var customer = Assert.Single(context.BillingCustomers.ToList());
        Assert.Equal("cus_test_1", customer.ExternalCustomerId);
        Assert.Empty(context.UserSubscriptions); // checkout activates nothing
    }

    [Fact]
    public async Task Checkout_ReusesExistingBillingCustomer()
    {
        using var db = new SqliteTestDatabase();
        var (_, priceId) = await BillingTestData.SeedPlanAsync(db);
        await BillingTestData.SeedBillingCustomerAsync(db, SqliteTestDatabase.UserId, "cus_existing");
        var (service, provider, _, _) = CreateService(db);

        await service.CreateCheckoutSessionAsync(CheckoutRequest(priceId), SqliteTestDatabase.UserId);

        Assert.Empty(provider.EnsuredCustomers);
        Assert.Equal("cus_existing", Assert.Single(provider.CheckoutRequests).ExternalCustomerId);
    }

    [Fact]
    public async Task Checkout_RejectsForeignOrigin()
    {
        using var db = new SqliteTestDatabase();
        var (_, priceId) = await BillingTestData.SeedPlanAsync(db);
        var (service, provider, _, _) = CreateService(db);
        var request = CheckoutRequest(priceId);
        request.SuccessUrl = "https://evil.example/steal";

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.CreateCheckoutSessionAsync(request, SqliteTestDatabase.UserId));
        Assert.Empty(provider.CheckoutRequests);
    }

    [Fact]
    public async Task Checkout_RejectsRelativeUrl()
    {
        using var db = new SqliteTestDatabase();
        var (_, priceId) = await BillingTestData.SeedPlanAsync(db);
        var (service, _, _, _) = CreateService(db);
        var request = CheckoutRequest(priceId);
        request.CancelUrl = "/subscription/cancel";

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.CreateCheckoutSessionAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Checkout_InactivePriceOrPrivatePlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, inactivePriceId) = await BillingTestData.SeedPlanAsync(db, stripePriceId: "price_a", priceIsActive: false);
        var (_, privatePriceId) = await BillingTestData.SeedPlanAsync(db, stripePriceId: "price_b", planIsPublic: false);
        var (service, _, _, _) = CreateService(db);

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.CreateCheckoutSessionAsync(CheckoutRequest(inactivePriceId), SqliteTestDatabase.UserId));
        await Assert.ThrowsAsync<FitMateException>(() =>
            service.CreateCheckoutSessionAsync(CheckoutRequest(privatePriceId), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Portal_WithoutBillingCustomer_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (service, provider, _, _) = CreateService(db);

        await Assert.ThrowsAsync<FitMateException>(() => service.CreateCustomerPortalSessionAsync(
            new CreateCustomerPortalSessionRequest { ReturnUrl = "https://app.fitmate.test/subscription" },
            SqliteTestDatabase.UserId));
        Assert.Empty(provider.PortalRequests);
    }

    [Fact]
    public async Task Portal_WithBillingCustomer_ReturnsUrl()
    {
        using var db = new SqliteTestDatabase();
        await BillingTestData.SeedBillingCustomerAsync(db, SqliteTestDatabase.UserId, "cus_existing");
        var (service, provider, _, _) = CreateService(db);

        var result = await service.CreateCustomerPortalSessionAsync(
            new CreateCustomerPortalSessionRequest { ReturnUrl = "https://app.fitmate.test/subscription" },
            SqliteTestDatabase.UserId);

        Assert.Equal("https://billing.stripe.test/p/session_123", result.Url);
        Assert.Equal(("cus_existing", "https://app.fitmate.test/subscription"), Assert.Single(provider.PortalRequests));
    }
```

- [ ] **Step 2: Run — expect FAIL** (`NotImplementedException`)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceTests`

- [ ] **Step 3: Implement** — replace the two `NotImplementedException` methods in `BillingService.cs` and add the private helpers:

```csharp
    public async Task<BillingRedirectModel> CreateCheckoutSessionAsync(CreateCheckoutSessionRequest request, long userId)
    {
        ValidateRedirectUrl(request.SuccessUrl);
        ValidateRedirectUrl(request.CancelUrl);

        var price = await dbContext.PlanPrices
            .AsNoTracking()
            .Include(p => p.Plan)
            .FirstOrDefaultAsync(p => p.Id == request.PlanPriceId);
        if (price == null || !price.IsActive || price.Plan == null || !price.Plan.IsActive || !price.Plan.IsPublic)
        {
            throw new FitMateException("The selected plan is not available.");
        }

        if (string.IsNullOrWhiteSpace(price.StripePriceId))
        {
            throw new FitMateException("The selected plan cannot be purchased online.");
        }

        var externalCustomerId = await EnsureBillingCustomerAsync(userId);
        var url = await billingProvider.CreateCheckoutSessionUrlAsync(
            new BillingCheckoutRequest
            {
                ExternalCustomerId = externalCustomerId,
                ExternalPriceId = price.StripePriceId,
                SuccessUrl = request.SuccessUrl,
                CancelUrl = request.CancelUrl,
                ClientReferenceId = userId.ToString(),
            },
            CancellationToken.None);

        return new BillingRedirectModel { Url = url };
    }

    public async Task<BillingRedirectModel> CreateCustomerPortalSessionAsync(CreateCustomerPortalSessionRequest request, long userId)
    {
        ValidateRedirectUrl(request.ReturnUrl);

        var customer = await dbContext.BillingCustomers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == StripeProviderName)
            ?? throw new FitMateException("No billing profile exists for this account yet.");

        var url = await billingProvider.CreateCustomerPortalUrlAsync(
            customer.ExternalCustomerId, request.ReturnUrl, CancellationToken.None);
        return new BillingRedirectModel { Url = url };
    }

    private void ValidateRedirectUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new FitMateException("Redirect URL must be an absolute http(s) URL.");
        }

        var origin = $"{uri.Scheme}://{uri.Authority}";
        var isAllowed = stripeOptions.AllowedRedirectOrigins
            .Any(allowed => string.Equals(allowed.TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase));
        if (!isAllowed)
        {
            throw new FitMateException("Redirect URL origin is not allowed.");
        }
    }

    private async Task<string> EnsureBillingCustomerAsync(long userId)
    {
        var existing = await dbContext.BillingCustomers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Provider == StripeProviderName);
        if (existing != null)
        {
            return existing.ExternalCustomerId;
        }

        var email = await dbContext.Users
            .Where(u => u.Id == userId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new FitMateException("User not found.");
        }

        var externalCustomerId = await billingProvider.EnsureCustomerAsync(userId, email, CancellationToken.None);
        dbContext.BillingCustomers.Add(new BillingCustomer
        {
            UserId = userId,
            Provider = StripeProviderName,
            ExternalCustomerId = externalCustomerId,
        });
        await dbContext.SaveChangesAsync();
        return externalCustomerId;
    }
```

- [ ] **Step 4: Run — expect PASS** (`--filter BillingServiceTests`, 11 tests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(billing): checkout and customer-portal sessions with redirect-origin validation"
```

---

### Task 7: Webhook pipeline — verify, insert-first idempotency, dispatch, status marking (TDD)

**Files:**
- Modify: `server/FitMate.Services/Billing/BillingService.cs`
- Create: `server/FitMate.Tests/TestInfrastructure/FakeBillingWebhookVerifier.cs` (if not already created in Task 5 Step 2)
- Test: `server/FitMate.Tests/Unit/Services/BillingServiceWebhookTests.cs`

**Interfaces:**
- Consumes: `IBillingWebhookVerifier`, `BillingWebhookEvent`, unique index from Task 1.
- Produces: `ProcessWebhookAsync` returning `BillingWebhookOutcome` (`InvalidSignature` → controller 400; everything else → 200). Handlers are wired in Task 8; this task lands the pipeline with dispatch returning "not handled" for all types.

Pipeline (spec order, non-negotiable):
(a) verify signature via the verifier (over the RAW body) — invalid → `InvalidSignature`, nothing stored;
(b) INSERT `BillingWebhookEvent` (`Status = Received`) FIRST — unique violation on `(Provider, ExternalEventId)` → `AlreadyProcessed`, no reprocessing;
(c) dispatch by `EventType`;
(d) invalidate the entitlement cache for the affected user;
(e) mark the event `Processed` / `Ignored` / `Failed` (+ `ErrorMessage`, `ProcessedAt`).

- [ ] **Step 1: Write the fake verifier** (`server/FitMate.Tests/TestInfrastructure/FakeBillingWebhookVerifier.cs`)

```csharp
using System.Text.Json;
using FitMate.Integrations.Billing.Abstractions;

namespace FitMate.Tests.TestInfrastructure;

public class FakeBillingWebhookVerifier : IBillingWebhookVerifier
{
    public bool FailSignature { get; set; }

    public BillingWebhookEnvelope VerifyAndParse(string payloadJson, string signatureHeader)
    {
        if (FailSignature)
        {
            throw new BillingWebhookSignatureException("Invalid signature.");
        }

        using var document = JsonDocument.Parse(payloadJson);
        return new BillingWebhookEnvelope
        {
            ExternalEventId = document.RootElement.GetProperty("id").GetString()!,
            EventType = document.RootElement.GetProperty("type").GetString()!,
            PayloadJson = payloadJson,
        };
    }
}
```

- [ ] **Step 2: Write failing tests** (`server/FitMate.Tests/Unit/Services/BillingServiceWebhookTests.cs`)

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.Billing.Stripe;
using FitMate.Services.Billing;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class BillingServiceWebhookTests
{
    private static (BillingService Service, FakeBillingWebhookVerifier Verifier, FakeEntitlementService Entitlements)
        CreateService(SqliteTestDatabase db)
    {
        var verifier = new FakeBillingWebhookVerifier();
        var entitlements = new FakeEntitlementService();
        var service = new BillingService(
            db.CreateContext(),
            new FakeBillingProvider(),
            verifier,
            Options.Create(new StripeOptions { AllowedRedirectOrigins = ["https://app.fitmate.test"] }),
            entitlements);
        return (service, verifier, entitlements);
    }

    private static string SimpleEventJson(string eventId, string eventType) =>
        $$"""{"id":"{{eventId}}","object":"event","type":"{{eventType}}","data":{"object":{}}}""";

    [Fact]
    public async Task Webhook_InvalidSignature_StoresNothing()
    {
        using var db = new SqliteTestDatabase();
        var (service, verifier, _) = CreateService(db);
        verifier.FailSignature = true;

        var outcome = await service.ProcessWebhookAsync(SimpleEventJson("evt_1", "invoice.paid"), "t=1,v1=bad");

        Assert.Equal(BillingWebhookOutcome.InvalidSignature, outcome);
        await using var context = db.CreateContext();
        Assert.Empty(context.BillingWebhookEvents);
    }

    [Fact]
    public async Task Webhook_UnknownEventType_MarksIgnored()
    {
        using var db = new SqliteTestDatabase();
        var (service, _, _) = CreateService(db);

        var outcome = await service.ProcessWebhookAsync(
            SimpleEventJson("evt_1", "customer.updated"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Ignored, outcome);
        await using var context = db.CreateContext();
        var stored = Assert.Single(context.BillingWebhookEvents.ToList());
        Assert.Equal(BillingWebhookStatus.Ignored, stored.Status);
        Assert.Equal("customer.updated", stored.EventType);
        Assert.NotNull(stored.ProcessedAt);
    }

    [Fact]
    public async Task Webhook_DuplicateExternalEventId_ReturnsSuccessWithoutReprocessing()
    {
        using var db = new SqliteTestDatabase();
        var (service, _, entitlements) = CreateService(db);

        var first = await service.ProcessWebhookAsync(SimpleEventJson("evt_dup", "customer.updated"), "t=1,v1=ok");
        var second = await service.ProcessWebhookAsync(SimpleEventJson("evt_dup", "customer.updated"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Ignored, first);
        Assert.Equal(BillingWebhookOutcome.AlreadyProcessed, second);
        await using var context = db.CreateContext();
        Assert.Single(context.BillingWebhookEvents.ToList());
        Assert.Empty(entitlements.InvalidatedUserIds);
    }

    [Fact]
    public async Task Webhook_HandlerFailure_MarksFailedWithErrorMessage()
    {
        using var db = new SqliteTestDatabase();
        var (service, _, _) = CreateService(db);
        // subscription event for a customer we have no BillingCustomer row for -> handler throws
        var payload = """
            {"id":"evt_orphan","object":"event","type":"customer.subscription.created",
             "data":{"object":{"id":"sub_1","customer":"cus_unknown","status":"active",
             "items":{"data":[{"price":{"id":"price_x"}}]}}}}
            """;

        var outcome = await service.ProcessWebhookAsync(payload, "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Failed, outcome);
        await using var context = db.CreateContext();
        var stored = Assert.Single(context.BillingWebhookEvents.ToList());
        Assert.Equal(BillingWebhookStatus.Failed, stored.Status);
        Assert.False(string.IsNullOrWhiteSpace(stored.ErrorMessage));
    }
}
```

(The `Webhook_HandlerFailure` test passes only after Task 8 wires the subscription handler; until then it fails — acceptable inside this task pair. Run it red here, green after Task 8.)

- [ ] **Step 3: Run — expect FAIL** (`ProcessWebhookAsync` throws `NotImplementedException`)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceWebhookTests`

- [ ] **Step 4: Implement the pipeline** in `BillingService.cs`:

```csharp
    public async Task<BillingWebhookOutcome> ProcessWebhookAsync(string payloadJson, string signatureHeader)
    {
        BillingWebhookEnvelope envelope;
        try
        {
            envelope = webhookVerifier.VerifyAndParse(payloadJson, signatureHeader);
        }
        catch (BillingWebhookSignatureException)
        {
            return BillingWebhookOutcome.InvalidSignature;
        }

        // (b) Insert-first idempotency: the unique index on (Provider, ExternalEventId) is the lock.
        var webhookEvent = new BillingWebhookEvent
        {
            Provider = StripeProviderName,
            ExternalEventId = envelope.ExternalEventId,
            EventType = envelope.EventType,
            PayloadJson = envelope.PayloadJson,
            Status = BillingWebhookStatus.Received,
            ReceivedAt = DateTime.UtcNow,
        };
        dbContext.BillingWebhookEvents.Add(webhookEvent);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            dbContext.Entry(webhookEvent).State = EntityState.Detached;
            var alreadyStored = await dbContext.BillingWebhookEvents
                .AsNoTracking()
                .AnyAsync(e => e.Provider == StripeProviderName
                    && e.ExternalEventId == envelope.ExternalEventId);
            if (alreadyStored)
            {
                return BillingWebhookOutcome.AlreadyProcessed;
            }

            throw;
        }

        try
        {
            var (handled, affectedUserId) = await DispatchAsync(envelope);

            if (affectedUserId.HasValue)
            {
                await entitlementService.InvalidateAsync(affectedUserId.Value);
            }

            webhookEvent.Status = handled ? BillingWebhookStatus.Processed : BillingWebhookStatus.Ignored;
            webhookEvent.ProcessedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return handled ? BillingWebhookOutcome.Processed : BillingWebhookOutcome.Ignored;
        }
        catch (Exception ex)
        {
            webhookEvent.Status = BillingWebhookStatus.Failed;
            // ErrorMessage column is capped at 2000 chars — truncate so marking Failed can never itself fail.
            webhookEvent.ErrorMessage = ex.Message.Length <= 2000 ? ex.Message : ex.Message[..2000];
            webhookEvent.ProcessedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return BillingWebhookOutcome.Failed;
        }
    }

    private async Task<(bool Handled, long? AffectedUserId)> DispatchAsync(BillingWebhookEnvelope envelope)
    {
        using var document = JsonDocument.Parse(envelope.PayloadJson);
        var dataObject = document.RootElement.GetProperty("data").GetProperty("object");

        return envelope.EventType switch
        {
            "checkout.session.completed" => (true, await HandleCheckoutCompletedAsync(dataObject)),
            "customer.subscription.created" or "customer.subscription.updated" =>
                (true, await HandleSubscriptionUpsertAsync(dataObject)),
            "customer.subscription.deleted" => (true, await HandleSubscriptionDeletedAsync(dataObject)),
            "invoice.paid" => (true, await HandleInvoicePaidAsync(dataObject)),
            "invoice.payment_failed" => (true, await HandleInvoicePaymentFailedAsync(dataObject)),
            _ => (false, null),
        };
    }
```

For this task only, add the five handler methods as stubs so the file compiles (Task 8 replaces them):

```csharp
    private Task<long?> HandleCheckoutCompletedAsync(JsonElement session) => Task.FromResult<long?>(null);
    private Task<long?> HandleSubscriptionUpsertAsync(JsonElement subscription) => Task.FromResult<long?>(null);
    private Task<long?> HandleSubscriptionDeletedAsync(JsonElement subscription) => Task.FromResult<long?>(null);
    private Task<long?> HandleInvoicePaidAsync(JsonElement invoice) => Task.FromResult<long?>(null);
    private Task<long?> HandleInvoicePaymentFailedAsync(JsonElement invoice) => Task.FromResult<long?>(null);
```

- [ ] **Step 5: Run** — `Webhook_InvalidSignature_StoresNothing`, `Webhook_UnknownEventType_MarksIgnored`, `Webhook_DuplicateExternalEventId_ReturnsSuccessWithoutReprocessing` PASS; `Webhook_HandlerFailure_MarksFailedWithErrorMessage` still FAILS (stub handler does not throw) — that is Task 8's job.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(billing): idempotent webhook pipeline with insert-first dedupe"
```

---

### Task 8: Webhook handlers — subscription lifecycle, invoices, entitlement invalidation (TDD)

**Files:**
- Modify: `server/FitMate.Services/Billing/BillingService.cs` (replace handler stubs)
- Create: `server/FitMate.Tests/TestInfrastructure/FakeEntitlementService.cs` (if not already created in Task 5 Step 2)
- Test: `server/FitMate.Tests/Unit/Services/BillingServiceWebhookTests.cs` (append)

**Interfaces:**
- Consumes: Plan 04's `UserSubscription`, `PlanPrice` (lookup by `StripePriceId`), `SubscriptionStatus`, Task 4's `IEntitlementService.InvalidateAsync`.
- Produces: fully working webhook handlers. Event semantics (spec, non-negotiable):
  - `checkout.session.completed` → link `BillingCustomer` if missing (from `client_reference_id` + `customer`); activate NOTHING.
  - `customer.subscription.created`/`updated` → upsert the user's `UserSubscription`: `PlanId` via `PlanPrice.StripePriceId` lookup, `Status` mapped from the Stripe status string, `CurrentPeriodStart/End`, `CancelAtPeriodEnd`, `ExternalSubscriptionId`.
  - `customer.subscription.deleted` → `Status = Cancelled`, `CancelledAt = now`.
  - `invoice.paid` → ensure `Active` (unless `Cancelled`).
  - `invoice.payment_failed` → `Status = PastDue`.

- [ ] **Step 1: Write the spy fake** (`server/FitMate.Tests/TestInfrastructure/FakeEntitlementService.cs`)

```csharp
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;

namespace FitMate.Tests.TestInfrastructure;

public class FakeEntitlementService : IEntitlementService
{
    public List<long> InvalidatedUserIds { get; } = [];

    public Task InvalidateAsync(long userId)
    {
        InvalidatedUserIds.Add(userId);
        return Task.CompletedTask;
    }

    // The members below must match Plan 04's actual IEntitlementService signatures —
    // verify against server/FitMate.Services/Subscriptions/IEntitlementService.cs at
    // execution time and adjust (billing tests never call them).
    public Task RequireFeatureAsync(long userId, SubscriptionFeature feature) => Task.CompletedTask;
    public Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature) =>
        throw new NotSupportedException("Not used by billing tests.");
    public Task<IReadOnlyList<EntitlementModel>> GetAllAsync(long userId) =>
        throw new NotSupportedException("Not used by billing tests.");
}
```

- [ ] **Step 2: Append failing lifecycle tests to `BillingServiceWebhookTests.cs`**

```csharp
    private static string SubscriptionEventJson(
        string eventId,
        string eventType,
        string subscriptionId = "sub_1",
        string customerId = "cus_1",
        string status = "active",
        string priceId = "price_plus_monthly",
        long periodStart = 1_785_000_000,
        long periodEnd = 1_787_678_400,
        bool cancelAtPeriodEnd = false) => $$"""
        {
          "id": "{{eventId}}",
          "object": "event",
          "type": "{{eventType}}",
          "data": {
            "object": {
              "id": "{{subscriptionId}}",
              "object": "subscription",
              "customer": "{{customerId}}",
              "status": "{{status}}",
              "cancel_at_period_end": {{(cancelAtPeriodEnd ? "true" : "false")}},
              "current_period_start": {{periodStart}},
              "current_period_end": {{periodEnd}},
              "items": { "data": [ { "price": { "id": "{{priceId}}" } } ] }
            }
          }
        }
        """;

    private static string InvoiceEventJson(string eventId, string eventType, string customerId = "cus_1") =>
        $$"""{"id":"{{eventId}}","object":"event","type":"{{eventType}}","data":{"object":{"object":"invoice","customer":"{{customerId}}"}}}""";

    private static async Task<(long PlanId, BillingService Service, FakeEntitlementService Entitlements)>
        SeedSubscribedSetupAsync(SqliteTestDatabase db)
    {
        var (planId, _) = await BillingTestData.SeedPlanAsync(db);
        await BillingTestData.SeedBillingCustomerAsync(db, SqliteTestDatabase.UserId, "cus_1");
        var (service, _, entitlements) = CreateService(db);
        return (planId, service, entitlements);
    }

    [Fact]
    public async Task Webhook_SubscriptionCreated_CreatesUserSubscriptionAndInvalidatesCache()
    {
        using var db = new SqliteTestDatabase();
        var (planId, service, entitlements) = await SeedSubscribedSetupAsync(db);

        var outcome = await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Processed, outcome);
        await using var context = db.CreateContext();
        var subscription = Assert.Single(context.UserSubscriptions.ToList());
        Assert.Equal(SqliteTestDatabase.UserId, subscription.UserId);
        Assert.Equal(planId, subscription.PlanId);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal("sub_1", subscription.ExternalSubscriptionId);
        Assert.False(subscription.CancelAtPeriodEnd);
        Assert.NotNull(subscription.CurrentPeriodStart);
        Assert.NotNull(subscription.CurrentPeriodEnd);
        Assert.Equal([SqliteTestDatabase.UserId], entitlements.InvalidatedUserIds);
    }

    [Fact]
    public async Task Webhook_SubscriptionUpdated_UpdatesExistingRow()
    {
        using var db = new SqliteTestDatabase();
        var (_, service, _) = await SeedSubscribedSetupAsync(db);
        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created"), "t=1,v1=ok");

        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_2", "customer.subscription.updated", cancelAtPeriodEnd: true),
            "t=1,v1=ok");

        await using var context = db.CreateContext();
        var subscription = Assert.Single(context.UserSubscriptions.ToList());
        Assert.True(subscription.CancelAtPeriodEnd);
    }

    [Fact]
    public async Task Webhook_DuplicateEventId_DoesNotReapplyStateChange()
    {
        using var db = new SqliteTestDatabase();
        var (_, service, _) = await SeedSubscribedSetupAsync(db);
        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created", status: "active"), "t=1,v1=ok");

        // Same event id replayed with a DIFFERENT body must be ignored entirely.
        var outcome = await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.updated", status: "past_due"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.AlreadyProcessed, outcome);
        await using var context = db.CreateContext();
        Assert.Equal(SubscriptionStatus.Active, Assert.Single(context.UserSubscriptions.ToList()).Status);
    }

    [Fact]
    public async Task Webhook_SubscriptionDeleted_SetsCancelledWithTimestamp()
    {
        using var db = new SqliteTestDatabase();
        var (_, service, _) = await SeedSubscribedSetupAsync(db);
        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created"), "t=1,v1=ok");

        var outcome = await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_2", "customer.subscription.deleted", status: "canceled"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Processed, outcome);
        await using var context = db.CreateContext();
        var subscription = Assert.Single(context.UserSubscriptions.ToList());
        Assert.Equal(SubscriptionStatus.Cancelled, subscription.Status);
        Assert.NotNull(subscription.CancelledAt);
    }

    [Fact]
    public async Task Webhook_InvoicePaymentFailed_SetsPastDue()
    {
        using var db = new SqliteTestDatabase();
        var (_, service, entitlements) = await SeedSubscribedSetupAsync(db);
        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created"), "t=1,v1=ok");

        var outcome = await service.ProcessWebhookAsync(
            InvoiceEventJson("evt_2", "invoice.payment_failed"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Processed, outcome);
        await using var context = db.CreateContext();
        Assert.Equal(SubscriptionStatus.PastDue, Assert.Single(context.UserSubscriptions.ToList()).Status);
        Assert.Contains(SqliteTestDatabase.UserId, entitlements.InvalidatedUserIds);
    }

    [Fact]
    public async Task Webhook_InvoicePaid_RestoresActive()
    {
        using var db = new SqliteTestDatabase();
        var (_, service, _) = await SeedSubscribedSetupAsync(db);
        await service.ProcessWebhookAsync(
            SubscriptionEventJson("evt_1", "customer.subscription.created", status: "past_due"), "t=1,v1=ok");

        var outcome = await service.ProcessWebhookAsync(
            InvoiceEventJson("evt_2", "invoice.paid"), "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Processed, outcome);
        await using var context = db.CreateContext();
        Assert.Equal(SubscriptionStatus.Active, Assert.Single(context.UserSubscriptions.ToList()).Status);
    }

    [Fact]
    public async Task Webhook_CheckoutCompleted_LinksBillingCustomerButActivatesNothing()
    {
        using var db = new SqliteTestDatabase();
        await BillingTestData.SeedPlanAsync(db);
        var (service, _, _) = CreateService(db); // note: NO BillingCustomer seeded
        var payload = $$"""
            {"id":"evt_1","object":"event","type":"checkout.session.completed",
             "data":{"object":{"object":"checkout.session","customer":"cus_new",
             "client_reference_id":"{{SqliteTestDatabase.UserId}}"}}}
            """;

        var outcome = await service.ProcessWebhookAsync(payload, "t=1,v1=ok");

        Assert.Equal(BillingWebhookOutcome.Processed, outcome);
        await using var context = db.CreateContext();
        var customer = Assert.Single(context.BillingCustomers.ToList());
        Assert.Equal("cus_new", customer.ExternalCustomerId);
        Assert.Equal(SqliteTestDatabase.UserId, customer.UserId);
        Assert.Empty(context.UserSubscriptions); // webhook-authoritative: checkout completion activates nothing
    }
```

- [ ] **Step 3: Run — expect FAIL** (stub handlers return null / do nothing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceWebhookTests`

- [ ] **Step 4: Implement the handlers** — replace the Task 7 stubs in `BillingService.cs`:

```csharp
    private async Task<long?> HandleCheckoutCompletedAsync(JsonElement session)
    {
        var externalCustomerId = GetString(session, "customer");
        var clientReferenceId = GetString(session, "client_reference_id");
        if (externalCustomerId == null || !long.TryParse(clientReferenceId, out var userId))
        {
            throw new FitMateException("checkout.session.completed is missing customer or client_reference_id.");
        }

        // Guard on BOTH unique indexes: (Provider, ExternalCustomerId) AND (UserId, Provider) —
        // a user who somehow already has a row with a different external id must not trigger
        // a unique violation here ("link if missing", never overwrite).
        var exists = await dbContext.BillingCustomers
            .AnyAsync(c => c.Provider == StripeProviderName
                && (c.ExternalCustomerId == externalCustomerId || c.UserId == userId));
        if (!exists)
        {
            dbContext.BillingCustomers.Add(new BillingCustomer
            {
                UserId = userId,
                Provider = StripeProviderName,
                ExternalCustomerId = externalCustomerId,
            });
            await dbContext.SaveChangesAsync();
        }

        // Deliberately no UserSubscription change: customer.subscription.created is authoritative.
        return userId;
    }

    private async Task<long?> HandleSubscriptionUpsertAsync(JsonElement subscription)
    {
        var externalSubscriptionId = GetString(subscription, "id")
            ?? throw new FitMateException("Subscription event is missing id.");
        var externalCustomerId = GetString(subscription, "customer")
            ?? throw new FitMateException("Subscription event is missing customer.");

        var customer = await dbContext.BillingCustomers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Provider == StripeProviderName
                && c.ExternalCustomerId == externalCustomerId)
            ?? throw new FitMateException($"No billing customer for '{externalCustomerId}'.");

        var priceId = GetSubscriptionPriceId(subscription)
            ?? throw new FitMateException("Subscription event has no price id.");
        var planPrice = await dbContext.PlanPrices
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.StripePriceId == priceId)
            ?? throw new FitMateException($"No plan price for Stripe price '{priceId}'.");

        var status = MapStripeSubscriptionStatus(GetString(subscription, "status"));
        var (periodStart, periodEnd) = GetCurrentPeriod(subscription);
        var cancelAtPeriodEnd = subscription.TryGetProperty("cancel_at_period_end", out var cape)
            && cape.ValueKind == JsonValueKind.True;

        var userSubscription = await dbContext.UserSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == customer.UserId);
        if (userSubscription == null)
        {
            userSubscription = new UserSubscription { UserId = customer.UserId };
            dbContext.UserSubscriptions.Add(userSubscription);
        }

        userSubscription.PlanId = planPrice.PlanId;
        userSubscription.Status = status;
        userSubscription.CurrentPeriodStart = periodStart;
        userSubscription.CurrentPeriodEnd = periodEnd;
        userSubscription.CancelAtPeriodEnd = cancelAtPeriodEnd;
        userSubscription.ExternalSubscriptionId = externalSubscriptionId;
        await dbContext.SaveChangesAsync();
        return customer.UserId;
    }

    private async Task<long?> HandleSubscriptionDeletedAsync(JsonElement subscription)
    {
        var externalSubscriptionId = GetString(subscription, "id");
        var userSubscription = await dbContext.UserSubscriptions
            .FirstOrDefaultAsync(s => s.ExternalSubscriptionId == externalSubscriptionId);
        if (userSubscription == null)
        {
            return null; // deletion for a subscription we never tracked — nothing to do
        }

        userSubscription.Status = SubscriptionStatus.Cancelled;
        userSubscription.CancelledAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        return userSubscription.UserId;
    }

    private async Task<long?> HandleInvoicePaidAsync(JsonElement invoice)
    {
        var userId = await ResolveUserIdByCustomerAsync(invoice);
        if (userId == null)
        {
            return null;
        }

        var userSubscription = await dbContext.UserSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId);
        if (userSubscription == null || userSubscription.Status == SubscriptionStatus.Cancelled)
        {
            return userId;
        }

        if (userSubscription.Status != SubscriptionStatus.Active)
        {
            userSubscription.Status = SubscriptionStatus.Active;
            await dbContext.SaveChangesAsync();
        }

        return userId;
    }

    private async Task<long?> HandleInvoicePaymentFailedAsync(JsonElement invoice)
    {
        var userId = await ResolveUserIdByCustomerAsync(invoice);
        if (userId == null)
        {
            return null;
        }

        var userSubscription = await dbContext.UserSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId);
        if (userSubscription == null)
        {
            return userId;
        }

        userSubscription.Status = SubscriptionStatus.PastDue;
        await dbContext.SaveChangesAsync();
        return userId;
    }

    private async Task<long?> ResolveUserIdByCustomerAsync(JsonElement dataObject)
    {
        var externalCustomerId = GetString(dataObject, "customer");
        if (externalCustomerId == null)
        {
            return null;
        }

        return await dbContext.BillingCustomers
            .AsNoTracking()
            .Where(c => c.Provider == StripeProviderName && c.ExternalCustomerId == externalCustomerId)
            .Select(c => (long?)c.UserId)
            .FirstOrDefaultAsync();
    }

    private static string? GetString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string? GetSubscriptionPriceId(JsonElement subscription)
    {
        if (!subscription.TryGetProperty("items", out var items)
            || !items.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Array
            || data.GetArrayLength() == 0)
        {
            return null;
        }

        var firstItem = data[0];
        return firstItem.TryGetProperty("price", out var price) ? GetString(price, "id") : null;
    }

    private static (DateTime? Start, DateTime? End) GetCurrentPeriod(JsonElement subscription)
    {
        // Stripe API versions before 2025-03 expose current_period_start/end on the subscription;
        // newer versions moved them onto each subscription item. Support both.
        var start = GetUnixDate(subscription, "current_period_start");
        var end = GetUnixDate(subscription, "current_period_end");
        if (start == null
            && subscription.TryGetProperty("items", out var items)
            && items.TryGetProperty("data", out var data)
            && data.ValueKind == JsonValueKind.Array
            && data.GetArrayLength() > 0)
        {
            start = GetUnixDate(data[0], "current_period_start");
            end = GetUnixDate(data[0], "current_period_end");
        }

        return (start, end);
    }

    private static DateTime? GetUnixDate(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Number
            ? DateTimeOffset.FromUnixTimeSeconds(value.GetInt64()).UtcDateTime
            : null;

    private static SubscriptionStatus MapStripeSubscriptionStatus(string? stripeStatus) => stripeStatus switch
    {
        "active" => SubscriptionStatus.Active,
        "trialing" => SubscriptionStatus.Trialing,
        "past_due" => SubscriptionStatus.PastDue,
        "unpaid" => SubscriptionStatus.PastDue,
        "canceled" => SubscriptionStatus.Cancelled,
        "incomplete" => SubscriptionStatus.Incomplete,
        "incomplete_expired" => SubscriptionStatus.Cancelled,
        "paused" => SubscriptionStatus.Paused,
        _ => throw new FitMateException($"Unknown Stripe subscription status '{stripeStatus}'."),
    };
```

> Verify `SubscriptionStatus` members against `server/FitMate.DB/Enums/SubscriptionStatus.cs` (Plan 04, spec §41) at execution time; map any member this switch is missing, and collapse mappings for members the enum does not have (e.g. if there is no `Paused`, map `"paused"` to `PastDue`).

- [ ] **Step 5: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingServiceWebhookTests` (11 tests, including Task 7's `Webhook_HandlerFailure_MarksFailedWithErrorMessage`), then the full suite: `dotnet test server/FitMate.sln`.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(billing): webhook subscription lifecycle handlers with entitlement invalidation"
```

---

### Task 9: BillingController, DI, configuration, type export

**Files:**
- Create: `server/FitMate.Web/Controllers/BillingController.cs`
- Modify: `server/FitMate.Web/Program.cs` (DI + `AddFitMateStripe`), `server/FitMate.Web/appsettings.json` (Stripe section)

**Interfaces:**
- Consumes: `IBillingService`, `BillingWebhookOutcome`.
- Produces the HTTP surface (spec §50) that Task 11's frontend consumes:

```
GET  /api/billing/plans                    → BillingPlanModel[]        [Authorize]
GET  /api/billing/me                       → MySubscriptionModel       [Authorize]
POST /api/billing/checkout-session         → BillingRedirectModel      [Authorize]  body: CreateCheckoutSessionRequest
POST /api/billing/customer-portal-session  → BillingRedirectModel      [Authorize]  body: CreateCustomerPortalSessionRequest
POST /api/billing/webhook                  → 200 (processed OR already-processed OR ignored OR failed) / 400 (bad signature only)   [AllowAnonymous], raw body + Stripe-Signature header
```

> **Decision (spec left it open):** `GET api/billing/plans` stays `[Authorize]` like the rest of the API — it needs `userId` to compute `IsCurrent`, and this repo has no anonymous marketing/pricing page. Revisit only if a public pricing page is ever added.

- [ ] **Step 1: Write the controller** (`server/FitMate.Web/Controllers/BillingController.cs`)

```csharp
using FitMate.Core.JsonModels.Billing;
using FitMate.DB;
using FitMate.Services.Billing;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/billing")]
public class BillingController : BaseApiController
{
    private readonly IBillingService billingService;

    public BillingController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IBillingService billingService)
        : base(logger, dbContext, userService)
    {
        this.billingService = billingService;
    }

    [HttpGet("plans")]
    public async Task<ActionResult> GetPlans()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var plans = await billingService.GetPlansAsync(userId.Value);
        return this.ReturnJson(plans);
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetMySubscription()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var subscription = await billingService.GetMySubscriptionAsync(userId.Value);
        return this.ReturnJson(subscription);
    }

    [HttpPost("checkout-session")]
    public async Task<ActionResult> CreateCheckoutSession([FromBody] CreateCheckoutSessionRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await billingService.CreateCheckoutSessionAsync(request, userId.Value);
        return this.ReturnJson(result);
    }

    [HttpPost("customer-portal-session")]
    public async Task<ActionResult> CreateCustomerPortalSession([FromBody] CreateCustomerPortalSessionRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await billingService.CreateCustomerPortalSessionAsync(request, userId.Value);
        return this.ReturnJson(result);
    }

    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        // Signature verification requires the RAW request body — no model binding here.
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();
        var signatureHeader = Request.Headers["Stripe-Signature"].ToString();

        var outcome = await billingService.ProcessWebhookAsync(payload, signatureHeader);

        // 400 only for bad signatures. Processed, already-processed, ignored AND failed all
        // return 200: failed events are persisted with Status=Failed for admin follow-up, and
        // the insert-first dedupe makes Stripe's retries no-ops anyway. Never leak details.
        return outcome == BillingWebhookOutcome.InvalidSignature ? BadRequest() : Ok();
    }
}
```

- [ ] **Step 2: Register DI + Stripe** — in `server/FitMate.Web/Program.cs`, add usings `FitMate.Integrations.Billing.Stripe;` and `FitMate.Services.Billing;`, then after the existing `AddScoped` block (~line 263):

```csharp
builder.Services.AddFitMateStripe(builder.Configuration);
builder.Services.AddScoped<IBillingService, BillingService>();
```

- [ ] **Step 3: Configuration** — in `server/FitMate.Web/appsettings.json` add after the `AzureStorage` section (secrets stay empty — env-only, validated at startup in Production by `AddFitMateStripe`; origins get dev defaults because they are not secret):

```json
  "Stripe": {
    "SecretKey": "",
    "WebhookSecret": "",
    "AllowedRedirectOrigins": [
      "http://localhost:5273",
      "https://localhost:5273"
    ]
  },
```

- [ ] **Step 4: Build + regenerate types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/backend.ts` contains `JsonModels.Billing.BillingPlanModel`, `MySubscriptionModel`, `CreateCheckoutSessionRequest`, `BillingRedirectModel` and the `SubscriptionStatus`/`BillingInterval`/`SubscriptionFeature`/`BillingWebhookStatus` enums; tsc clean.

- [ ] **Step 5: Run full test suite**

Run: `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Web client/src/types
git commit -m "feat(billing): billing API controller, Stripe DI and config, generated types"
```

---

### Task 10: Integration tests — webhook endpoint anonymous + bad signature

**Files:**
- Create: `server/FitMate.Tests/Integration/BillingApiTests.cs`

**Interfaces:** consumes `TestWebApplicationFactory` + `IntegrationTestExtensions`. The factory sets no Stripe env vars, so `StripeOptions.WebhookSecret` is empty and the REAL `StripeWebhookVerifier` fails closed — deterministic 400 without any Stripe config.

- [ ] **Step 1: Write the tests**

```csharp
using System.Net;
using System.Text;
using FitMate.DB;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

// Repo convention (AuthorizationApiTests.cs, AuthApiTests.cs): one TestWebApplicationFactory
// per test — each test gets an isolated in-memory database. Do NOT use IClassFixture.
public class BillingApiTests
{
    [Fact]
    public async Task Webhook_IsAnonymous_BadSignatureReturns400AndStoresNothing()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient(); // NO authentication
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/billing/webhook")
        {
            Content = new StringContent(
                """{"id":"evt_it_1","object":"event","type":"invoice.paid","data":{"object":{}}}""",
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.TryAddWithoutValidation("Stripe-Signature", "t=123,v1=deadbeef");

        using var response = await client.SendAsync(request);

        // 400 (bad signature), NOT 401 — the endpoint must be reachable anonymously.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await dbContext.BillingWebhookEvents.AnyAsync(e => e.ExternalEventId == "evt_it_1"));
    }

    [Fact]
    public async Task Webhook_MissingSignatureHeader_Returns400()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();
        using var response = await client.PostAsync(
            "/api/billing/webhook",
            new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BillingEndpoints_RequireAuthentication()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        using var plansResponse = await client.GetAsync("/api/billing/plans");
        using var meResponse = await client.GetAsync("/api/billing/me");

        // Matches AuthorizationApiTests.cs: protected endpoints return 401 without auth.
        Assert.Equal(HttpStatusCode.Unauthorized, plansResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, meResponse.StatusCode);
    }
}
```

- [ ] **Step 2: Run**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter BillingApiTests`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add server/FitMate.Tests
git commit -m "test(billing): webhook anonymity and bad-signature integration tests"
```

---

### Task 11: Frontend — billing service, types, /subscription page

**Files:**
- Create: `client/src/services/billingService.ts`
- Modify: `client/src/types/index.ts` (re-exports)
- Create: `client/src/pages/Subscription/Subscription.tsx`, `client/src/pages/Subscription/index.ts`, `client/src/pages/Subscription/hooks/useSubscriptionPage.ts`, `client/src/pages/Subscription/components/CurrentPlanCard.tsx`

**Interfaces:**
- Consumes: generated `JsonModels.Billing.*` types from `client/src/types/backend.ts` (Task 9), `api` axios instance, `unwrap` helper. NEVER hand-write interfaces for API models.
- Produces: `billingService` with `getPlans` / `getMySubscription` / `createCheckoutSession` / `createCustomerPortalSession`; type aliases `BillingPlan`, `BillingPlanPrice`, `BillingPlanEntitlement`, `MySubscription`, `BillingRedirect` (request types are exported via the existing `export * from "./JsonModels"` star export — no aliases). Task 12 reuses all of these.

- [ ] **Step 1: Type re-exports** — append to the alias list in `client/src/types/index.ts` (keep alphabetical order with existing entries):

```ts
export type BillingPlan = JsonModels.Billing.BillingPlanModel;
export type BillingPlanEntitlement = JsonModels.Billing.BillingPlanEntitlementModel;
export type BillingPlanPrice = JsonModels.Billing.BillingPlanPriceModel;
export type BillingRedirect = JsonModels.Billing.BillingRedirectModel;
export type MySubscription = JsonModels.Billing.MySubscriptionModel;
```

Do NOT alias `CreateCheckoutSessionRequest` / `CreateCustomerPortalSessionRequest` — repo convention aliases only `*Model` types; request types are already exported verbatim via the `export * from "./JsonModels"` star export (compare `LogBodyMetricRequest`), so `import type { CreateCheckoutSessionRequest } from "@/types"` works without an alias.

(Enums like `SubscriptionStatus` are exported via the `Enums` namespace/`types/JsonModels/Enums` re-exports — check how `UserRole` is exposed in `client/src/types` and import `SubscriptionStatus` the same way.)

- [ ] **Step 2: Write the service** (`client/src/services/billingService.ts` — mirrors `bodyMetricService.ts`)

```ts
import api from "@/lib/api";
import type {
  BillingPlan,
  BillingRedirect,
  CreateCheckoutSessionRequest,
  CreateCustomerPortalSessionRequest,
  JsonData,
  MySubscription,
} from "@/types";

export const billingService = {
  async getPlans() {
    return api.get<JsonData<BillingPlan[]>>("billing/plans");
  },

  async getMySubscription() {
    return api.get<JsonData<MySubscription>>("billing/me");
  },

  async createCheckoutSession(payload: CreateCheckoutSessionRequest) {
    return api.post<JsonData<BillingRedirect>>("billing/checkout-session", payload);
  },

  async createCustomerPortalSession(payload: CreateCustomerPortalSessionRequest) {
    return api.post<JsonData<BillingRedirect>>("billing/customer-portal-session", payload);
  },
};
```

- [ ] **Step 3: Write the page hook** (`client/src/pages/Subscription/hooks/useSubscriptionPage.ts` — same shape as `useWeightLogPage.ts`)

```ts
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { billingService } from "@/services/billingService";
import type { MySubscription } from "@/types";

export function useSubscriptionPage() {
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirectingToPortal, setIsRedirectingToPortal] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await billingService.getMySubscription();
        setSubscription(unwrap(response.data, "Unable to load your subscription."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load your subscription.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const openCustomerPortal = useCallback(async () => {
    setIsRedirectingToPortal(true);

    try {
      const response = await billingService.createCustomerPortalSession({
        returnUrl: `${window.location.origin}/subscription`,
      });
      const { url } = unwrap(response.data, "Unable to open the billing portal.");
      window.location.assign(url);
    } catch (portalError) {
      toast.error(
        portalError instanceof Error ? portalError.message : "Unable to open the billing portal.",
      );
      setIsRedirectingToPortal(false);
    }
  }, []);

  return { subscription, isLoading, error, isRedirectingToPortal, openCustomerPortal };
}
```

- [ ] **Step 4: Write the components**

`client/src/pages/Subscription/components/CurrentPlanCard.tsx` (styling: reuse the card/list utility classes seen in `pages/WeightLog/components` — `text-foreground`, `text-muted`, `text-2xs`, divider variables; adjust class names to the repo's actual utilities at execution time):

```tsx
import type { MySubscription } from "@/types";

type CurrentPlanCardProps = {
  subscription: MySubscription;
  isRedirectingToPortal: boolean;
  onManageBilling: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMATTER.format(date);
}

export function CurrentPlanCard({
  subscription,
  isRedirectingToPortal,
  onManageBilling,
}: CurrentPlanCardProps) {
  const renewalDate = formatDate(subscription.currentPeriodEnd);

  return (
    <section className="rounded-xl border border-(--glass-divider) p-4">
      <p className="text-2xs font-medium uppercase text-muted">Current plan</p>
      <h2 className="mt-1 text-lg font-bold text-foreground">
        {subscription.hasSubscription ? (subscription.planName ?? "Unknown plan") : "Free"}
      </h2>

      {subscription.hasSubscription && renewalDate ? (
        <p className="mt-2 text-sm text-muted">
          {subscription.cancelAtPeriodEnd
            ? `Your plan is set to cancel on ${renewalDate}. You keep access until then.`
            : `Renews on ${renewalDate}.`}
        </p>
      ) : null}

      {subscription.hasSubscription ? (
        <button
          type="button"
          onClick={onManageBilling}
          disabled={isRedirectingToPortal}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isRedirectingToPortal ? "Opening…" : "Manage billing"}
        </button>
      ) : null}
    </section>
  );
}
```

`client/src/pages/Subscription/Subscription.tsx`:

```tsx
import { Link } from "react-router";
import { CurrentPlanCard } from "./components/CurrentPlanCard";
import { useSubscriptionPage } from "./hooks/useSubscriptionPage";

export default function Subscription() {
  const { subscription, isLoading, error, isRedirectingToPortal, openCustomerPortal } =
    useSubscriptionPage();

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-lg font-bold text-foreground">Subscription</h1>

      {isLoading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {subscription ? (
        <div className="mt-4 space-y-4">
          <CurrentPlanCard
            subscription={subscription}
            isRedirectingToPortal={isRedirectingToPortal}
            onManageBilling={() => void openCustomerPortal()}
          />

          <Link to="/subscription/plans" className="block text-sm font-medium text-primary">
            {subscription.hasSubscription ? "Change plan" : "View plans"}
          </Link>
          {/* Usage overview is delivered by Plan 04's frontend — verify its route at
              execution time and keep this link in sync (expected: /subscription/usage). */}
          <Link to="/subscription/usage" className="block text-sm font-medium text-primary">
            Usage
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

`client/src/pages/Subscription/index.ts`:

```ts
export { default } from "./Subscription";
```

- [ ] **Step 5: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(billing): billing service and subscription page"
```

---

### Task 12: Frontend — plans page, checkout redirect, success/cancel landings, routes

**Files:**
- Create: `client/src/pages/SubscriptionPlans/SubscriptionPlans.tsx`, `client/src/pages/SubscriptionPlans/index.ts`, `client/src/pages/SubscriptionPlans/hooks/useSubscriptionPlansPage.ts`, `client/src/pages/SubscriptionPlans/components/PlanCard.tsx`
- Create: `client/src/pages/Subscription/components/CheckoutResult.tsx`
- Modify: `client/src/routes.tsx`

**Interfaces:**
- Consumes: Task 11's `billingService` + type aliases.
- Produces routes: `/subscription`, `/subscription/plans`, `/subscription/success`, `/subscription/cancel`.

- [ ] **Step 1: Write the plans hook** (`client/src/pages/SubscriptionPlans/hooks/useSubscriptionPlansPage.ts`)

```ts
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { billingService } from "@/services/billingService";
import type { BillingPlan } from "@/types";

export function useSubscriptionPlansPage() {
  const [plans, setPlans] = useState<BillingPlan[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribingPriceId, setSubscribingPriceId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await billingService.getPlans();
        setPlans(unwrap(response.data, "Unable to load plans."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load plans.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const subscribe = useCallback(async (planPriceId: number) => {
    setSubscribingPriceId(planPriceId);

    try {
      const response = await billingService.createCheckoutSession({
        planPriceId,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription/cancel`,
      });
      const { url } = unwrap(response.data, "Unable to start checkout.");
      window.location.assign(url);
    } catch (checkoutError) {
      toast.error(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout.");
      setSubscribingPriceId(null);
    }
  }, []);

  return { plans, isLoading, error, subscribingPriceId, subscribe };
}
```

- [ ] **Step 2: Write the plan card** (`client/src/pages/SubscriptionPlans/components/PlanCard.tsx`)

```tsx
import { BillingInterval, SubscriptionFeature } from "@/types";
import type { BillingPlan, BillingPlanPrice } from "@/types";

type PlanCardProps = {
  plan: BillingPlan;
  subscribingPriceId: number | null;
  onSubscribe: (planPriceId: number) => void;
};

function formatPrice(price: BillingPlanPrice): string {
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.amountCents / 100);
  // Verify the member name against the generated BillingInterval enum at execution time
  // (Plan 04 defines it; if it is e.g. `Annual` instead of `Yearly`, use that member —
  // never compare against a numeric literal).
  return `${amount} / ${price.interval === BillingInterval.Yearly ? "year" : "month"}`;
}

export function PlanCard({ plan, subscribingPriceId, onSubscribe }: PlanCardProps) {
  const isFree = plan.prices.length === 0;

  return (
    <section
      className={`rounded-xl border p-4 ${
        plan.isCurrent ? "border-primary" : "border-(--glass-divider)"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">{plan.name}</h2>
        {plan.isCurrent ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
            Current plan
          </span>
        ) : null}
      </div>

      {plan.description ? <p className="mt-1 text-sm text-muted">{plan.description}</p> : null}

      <ul className="mt-3 space-y-1">
        {plan.entitlements.map((entitlement) => (
          <li key={entitlement.feature} className="text-sm text-muted">
            {formatEntitlement(entitlement.feature, entitlement.limit)}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2">
        {isFree && !plan.isCurrent ? (
          <p className="text-sm text-muted">Included by default.</p>
        ) : null}
        {plan.prices.map((price) => (
          <button
            key={price.id}
            type="button"
            onClick={() => onSubscribe(price.id)}
            disabled={plan.isCurrent || subscribingPriceId != null}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {subscribingPriceId === price.id ? "Redirecting…" : `Subscribe — ${formatPrice(price)}`}
          </button>
        ))}
      </div>
    </section>
  );
}

// Optional prettier labels; anything not listed falls back to the enum member name split
// into words (generated numeric enums have a reverse mapping), so every SubscriptionFeature
// member renders sensibly without this map needing maintenance when Plan 04's enum changes.
const FEATURE_LABEL_OVERRIDES: Partial<Record<SubscriptionFeature, string>> = {};

function formatEntitlement(feature: SubscriptionFeature, limit: number | null | undefined): string {
  const memberName: string | undefined = SubscriptionFeature[feature];
  const label =
    FEATURE_LABEL_OVERRIDES[feature] ??
    (memberName ? memberName.replace(/([a-z0-9])([A-Z])/g, "$1 $2") : `Feature ${feature}`);
  return limit == null ? label : `${label}: ${limit}`;
}
```

- [ ] **Step 3: Write the page + landing components**

`client/src/pages/SubscriptionPlans/SubscriptionPlans.tsx`:

```tsx
import { PlanCard } from "./components/PlanCard";
import { useSubscriptionPlansPage } from "./hooks/useSubscriptionPlansPage";

export default function SubscriptionPlans() {
  const { plans, isLoading, error, subscribingPriceId, subscribe } = useSubscriptionPlansPage();

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-lg font-bold text-foreground">Plans</h1>

      {isLoading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 space-y-4">
        {(plans ?? []).map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            subscribingPriceId={subscribingPriceId}
            onSubscribe={(planPriceId) => void subscribe(planPriceId)}
          />
        ))}
      </div>
    </div>
  );
}
```

`client/src/pages/SubscriptionPlans/index.ts`:

```ts
export { default } from "./SubscriptionPlans";
```

`client/src/pages/Subscription/components/CheckoutResult.tsx` — pure status page, NO entitlement assumptions (the webhook is authoritative; the success page must not claim the plan is active):

```tsx
import { Link } from "react-router";

type CheckoutResultProps = {
  variant: "success" | "cancel";
};

export default function CheckoutResult({ variant }: CheckoutResultProps) {
  const isSuccess = variant === "success";

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-lg font-bold text-foreground">
        {isSuccess ? "Payment received" : "Checkout cancelled"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isSuccess
          ? "Thanks! Your subscription activates as soon as Stripe confirms the payment — this usually takes a few seconds."
          : "No changes were made to your subscription."}
      </p>
      <Link to="/subscription" className="mt-6 inline-block text-sm font-medium text-primary">
        Go to subscription
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Routes** — in `client/src/routes.tsx` add imports:

```tsx
import Subscription from "./pages/Subscription";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import CheckoutResult from "./pages/Subscription/components/CheckoutResult";
```

and a new child block after the `weight-log` route (same `AccessGate` + `Outlet` pattern as the `workouts` block):

```tsx
      {
        path: "subscription",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Subscription />,
          },
          {
            path: "plans",
            element: <SubscriptionPlans />,
          },
          {
            path: "success",
            element: <CheckoutResult variant="success" />,
          },
          {
            path: "cancel",
            element: <CheckoutResult variant="cancel" />,
          },
        ],
      },
```

- [ ] **Step 5: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(billing): plans page, checkout redirect and success/cancel landings"
```

---

## Acceptance criteria (Plan 09 done)

- **Entities:** `BillingCustomer` (unique `(UserId, Provider)` + `(Provider, ExternalCustomerId)`) and `BillingWebhookEvent` (unique `(Provider, ExternalEventId)`, `BillingWebhookStatus` Received/Processed/Failed/Ignored, `ErrorMessage`, `ReceivedAt`, `ProcessedAt`) exist with migration `AddStripeBillingEntities`.
- **Provider isolation:** all Stripe.net usage lives in `server/FitMate.Integrations/Billing/Stripe`; services/controllers consume only `IBillingProvider` / `IBillingWebhookVerifier` and neutral models (`grep -r "using Stripe" server/FitMate.Services server/FitMate.Web server/FitMate.Core` finds nothing).
- **Checkout:** validates the price is active on an active public plan, validates successUrl/cancelUrl origins against `Stripe:AllowedRedirectOrigins` (rejecting e.g. `https://evil.example`), ensures a Stripe customer + `BillingCustomer` row, and creates the session with the plan's `StripePriceId` and `client_reference_id = userId`. The success redirect activates nothing.
- **Portal:** requires an existing `BillingCustomer`, validates the return URL origin, returns the portal URL.
- **Webhook (authoritative):** signature verified over the raw request body; event row inserted FIRST with duplicate `(Provider, ExternalEventId)` returning success without reprocessing; `checkout.session.completed` links `BillingCustomer`; `customer.subscription.created/updated` upserts `UserSubscription` (PlanId via `PlanPrice.StripePriceId`, mapped `SubscriptionStatus`, period dates, `CancelAtPeriodEnd`, `ExternalSubscriptionId`); `customer.subscription.deleted` → `Cancelled` + `CancelledAt`; `invoice.paid` → ensure `Active`; `invoice.payment_failed` → `PastDue`; entitlement cache invalidated via `IEntitlementService.InvalidateAsync(userId)` for every affecting event; events marked `Processed`/`Ignored`/`Failed` with `ProcessedAt`.
- **API (spec §50):** `GET api/billing/plans`, `GET api/billing/me`, `POST api/billing/checkout-session` → `{ url }`, `POST api/billing/customer-portal-session` → `{ url }` (all `[Authorize]`); `POST api/billing/webhook` `[AllowAnonymous]` reading raw body + `Stripe-Signature`, returning 200 for processed AND already-processed, 400 only for bad signature, never leaking error details.
- **Config:** `Stripe:SecretKey` / `Stripe:WebhookSecret` env-only (empty in appsettings.json); startup validation fails the app in Production when either secret is missing or `Stripe:AllowedRedirectOrigins` is empty.
- **Tests (spec §76):** signature failure → 400/no event stored; duplicate event id → success without a second state change; created/updated/deleted lifecycle; payment failure → PastDue; entitlement-cache invalidation spy; `https://evil.example` origin rejection; portal-requires-customer; integration tests for webhook anonymity + bad signature.
- **Frontend:** `/subscription` (current plan, renewal date, cancellation notice, Manage billing → portal redirect, links to plans + usage), `/subscription/plans` (plan cards with prices + entitlement list, current plan highlighted, Subscribe → checkout redirect), `/subscription/success` and `/subscription/cancel` status-only landings with no entitlement assumptions.
- `dotnet build server/FitMate.sln`, `dotnet test server/FitMate.sln`, and `cd client && npm run lint && npx tsc -b --noEmit` all pass.
