# Operations: hosting, logging and configuration

FitMate runs as a container on Railway, behind a TLS-terminating proxy, with a managed Postgres.
The container filesystem is ephemeral — anything that must survive a deploy has to live in the
database or in blob storage.

---

## The container

`server/Dockerfile`, two stages. Notable details:

```dockerfile
# Codegen is skipped in the image build: it would write ../../client/src/types/backend.ts,
# and the client folder is not in the build context. The generated file is committed instead.
RUN dotnet publish FitMate.Web/FitMate.Web.csproj -c Release -o /app/publish -p:RtDisable=true

# The aspnet base image ships ASPNETCORE_HTTP_PORTS=8080, which conflicts with ASPNETCORE_URLS
# below. Cleared so there is a single source of truth for the bound port.
ENV ASPNETCORE_HTTP_PORTS=

# Shell form, so $PORT expands at runtime — Railway injects it.
CMD ASPNETCORE_URLS=http://0.0.0.0:$PORT dotnet FitMate.Web.dll
```

Migrations run at startup (`app.MigrateDatabase()` → `Database.Migrate()`, 5-minute command timeout),
followed by seeding. A deploy therefore applies pending migrations automatically; there is no
separate migration step.

---

## Running behind the proxy

Railway terminates TLS and forwards the original scheme and client IP in `X-Forwarded-*`. The app must
be told to trust them, as the **first** middleware in the pipeline:

```csharp
if (!app.Environment.IsDevelopment())
{
    var forwardedHeadersOptions = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedFor,
    };
    forwardedHeadersOptions.KnownNetworks.Clear();
    forwardedHeadersOptions.KnownProxies.Clear();

    app.UseForwardedHeaders(forwardedHeadersOptions);
    app.UseHttpsRedirection();
}
```

Without it the app only ever sees plain HTTP: `Request.IsHttps` is false, so `UseHttpsRedirection`
tries to redirect every already-secure request, fails to find an HTTPS port to redirect to, and logs
a warning per request. The allow-list is cleared rather than pinned because Railway's proxy address
is not stable.

---

## Data protection

The key ring is persisted to the database, not the filesystem:

```csharp
builder.Services
    .AddDataProtection()
    .PersistKeysToDbContext<AppDbContext>()
    .SetApplicationName("FitMate");
```

`AppDbContext` implements `IDataProtectionKeyContext`; the table comes from the
`AddDataProtectionKeys` migration.

**Why this matters.** The default store writes to `/root/.aspnet/DataProtection-Keys` inside the
container, which is discarded on every deploy. Each release generated a fresh key ring, and anything
protected by the previous one stopped validating. In production this silently invalidated every
password-reset link that had already been emailed — three separate key rings were generated in the
first three weeks. `SetApplicationName` pins the key-derivation discriminator so keys stay
interchangeable across deploys and instances.

What depends on it: **Identity token providers** (`AddDefaultTokenProviders()` →
`GeneratePasswordResetTokenAsync`). A password-reset token is not stored anywhere — it *is* a
protected payload the server unprotects later.

What does **not**: JWTs are signed with `Jwt:SigningKey` from configuration, which is stable across
deploys. That is why logins were unaffected while password resets were broken — and why the bug went
unnoticed, since it only affected users who could not log in to complain.

Keys are stored unencrypted at rest (no DPAPI on Linux; encrypting would mean managing a
certificate). Regression tests: `FitMate.Tests/Integration/DataProtectionKeyRingTests.cs`.

---

## Logging

Serilog replaces the default providers. Two sinks:

- **Console** — captured by Railway's log stream. There is no file sink; the host filesystem is not
  durable.
- **`SerilogDatabaseSink`** — Warning and above into the `Errors` table, which backs the admin error
  grid.

```csharp
.MinimumLevel.Information()
.MinimumLevel.Override("Microsoft.AspNetCore",                LogEventLevel.Warning)
.MinimumLevel.Override("Microsoft.AspNetCore.HttpsPolicy",    LogEventLevel.Error)
.MinimumLevel.Override("Microsoft.AspNetCore.DataProtection", LogEventLevel.Error)
.MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
```

### Overrides match the full logger category

This is the trap. Serilog matches an override against the logger category by namespace prefix, and
the category is the middleware's **full type name**. An override keyed on a namespace that does not
exist matches nothing and fails silently.

An earlier override was written as `Microsoft.AspNetCore.HttpsRedirection`. The real category is
`Microsoft.AspNetCore.HttpsPolicy.HttpsRedirectionMiddleware` — the namespace is `HttpsPolicy`. The
filter never fired, and the per-request warning it was meant to suppress accumulated in production
until the error grid contained nothing but framework noise.

When adding an override, confirm the category from a real log row (the `Source` column in `Errors`)
rather than guessing from the type name. Regression tests:
`ErrorLoggingApiTests.HostingInfrastructureWarning_IsNotPersistedToErrorsTable`, with
`ApplicationWarning_IsPersistedToErrorsTable` guarding against widening the filter into a blanket
`Microsoft.AspNetCore` mute.

`preserveStaticLogger: true` keeps the logger host-scoped instead of assigning the process-global
`Log.Logger`, so parallel test hosts do not route each other's log events.

---

## Configuration

Layered: `appsettings.json` (shape, empty values) → `appsettings.Local.json` (git-ignored, local
secrets) → environment variables (`Section__Key`) in production.

| Section | Notes |
|---|---|
| `ConnectionStrings:DefaultConnection` | Npgsql key-value form. Npgsql does **not** accept `postgresql://` URLs — a Railway `DATABASE_URL` must be reformatted. Use the public `*.proxy.rlwy.net` host, not `*.railway.internal`, from outside the platform. |
| `Jwt`, `RefreshToken` | signing keys, issuer, audience, lifetimes |
| `Application` | `Url`, `ClientUrl`, `AllowedOrigins` (CORS) |
| `AI` | provider, model names, timeout, tool limits, retention — see [ai-coach.md](ai-coach.md) |
| `OpenAI` | `ApiKey`, `Endpoint` |
| `AzureStorage` | connection string, container, SAS minutes |
| `Email` | Brevo SMTP relay |
| `AdminUser` | seeded admin account |

`AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)` is set before the host is built.
The app stores UTC and previously ran on SQL Server `datetime2`; legacy behaviour maps `DateTime` to
`timestamp without time zone` and stops Npgsql throwing on `DateTime`s with
`Kind=Unspecified/Local` bound from request payloads.

---

## FitMate.Tools

A console app for one-off operational commands that run **directly against a real environment's
database and blob storage**. Treat every run as production. Configured by its own
`appsettings.Local.json`. Current command: `import-exercise-images <folder> [--dry-run]`, which
matches files to exercises by slug and runs as the first admin user.

---

## Tests

`dotnet test server/FitMate.Tests/FitMate.Tests.csproj` — 386 tests.

- **Unit** (`Unit/Services/`) use `SqliteTestDatabase`: in-memory SQLite seeded with `UserId=1`,
  `OtherUserId=2`, `AdminUserId=3` and muscle groups Chest/Back/Legs.
- **Integration** (`Integration/`) use `TestWebApplicationFactory`, which boots the real host over
  in-memory SQLite and swaps in `FakeAICompletionProvider` — no test ever calls a real model.
  The factory accepts another factory's `Connection` to stand a second host over the same database,
  which is how a redeploy is simulated.

The `Testing` environment is not `Development`, so forwarded headers and HTTPS redirection are
exercised by integration tests exactly as configured in production.
