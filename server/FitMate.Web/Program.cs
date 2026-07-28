using FitMate.Core.Common;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Analytics;
using FitMate.Services.Auth;
using FitMate.Services.BodyMetrics;
using FitMate.Services.Email;
using FitMate.Services.Errors;
using FitMate.Services.Exercises;
using FitMate.Services.MuscleGroups;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using FitMate.Services.Storage.Urls;
using FitMate.Services.TrainingProfiles;
using FitMate.Services.Users;
using FitMate.Services.Workouts;
using FitMate.Services.WorkoutTemplates;
using FitMate.Web.Attributes;
using FitMate.Web.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;
using System.Security.Claims;
using System.Text;

// The app stores all timestamps as UTC (see AppDbContext.AddTimestamps) and previously ran
// on SQL Server (datetime2, no time-zone). Legacy timestamp behavior maps DateTime to
// `timestamp without time zone`, preserving that semantics and avoiding Npgsql throwing on
// DateTimes with Kind=Unspecified/Local (e.g. dates bound from request payloads).
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Route all ILogger output through Serilog. Console is captured by the (serverless) host's log
// stream; the custom database sink persists Warning+ events to the Errors table so the admin error
// grid sees model-validation failures, service-level warnings/errors and background work — not just
// the unhandled 500s the exception filter writes directly. No file sink: the host FS is read-only.
builder.Logging.ClearProviders();
builder.Services.AddSerilog((services, loggerConfiguration) => loggerConfiguration
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    // UseHttpsRedirection warns on every request when no HTTPS port is resolvable (e.g. behind a
    // TLS-terminating proxy). Keep that per-request noise out of the Errors table.
    .MinimumLevel.Override("Microsoft.AspNetCore.HttpsRedirection", LogEventLevel.Error)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.With(new SerilogHttpContextDataEnricher(services.GetRequiredService<IHttpContextAccessor>()))
    .WriteTo.Console()
    .WriteTo.Sink(
        new SerilogDatabaseSink(services.GetRequiredService<IServiceScopeFactory>()),
        restrictedToMinimumLevel: LogEventLevel.Warning),
    // Keep the logger scoped to this host instead of assigning the process-global Log.Logger. The app
    // only ever logs through ILogger<T>, and not touching global state keeps parallel test hosts (each
    // WebApplicationFactory spins up its own host in-process) from routing each other's logs.
    preserveStaticLogger: true);

var configuredOrigins = builder.Configuration
    .GetSection("Application:AllowedOrigins")
    .Get<string[]>() ?? [];

var allowedOrigins = configuredOrigins
    .Concat([
        builder.Configuration["Application:ClientUrl"],
        "http://localhost:5273",
        "https://localhost:5273",
    ])
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin!.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddScoped<LogApiErrorAttribute>();
builder.Services
    .AddControllers(options => options.Filters.AddService<LogApiErrorAttribute>())
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var error = context.ModelState.Values
                .SelectMany(entry => entry.Errors)
                .Select(modelError => modelError.ErrorMessage)
                .FirstOrDefault(message => !string.IsNullOrWhiteSpace(message))
                ?? "One or more validation errors occurred.";

            // Model-validation 400s never reach the exception filter (they short-circuit before the
            // action runs), so log them here at Warning to make them visible in the Errors table via
            // the Serilog database sink — these usually signal a malformed request or a client bug.
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("FitMate.Web.ModelValidation");
            logger.LogWarning(
                "Model validation failed on {Method} {Path}: {Error}",
                context.HttpContext.Request.Method,
                context.HttpContext.Request.Path,
                error);

            return new JsonResult(new CommonJsonModel<object?>(error: error, data: null))
            {
                StatusCode = StatusCodes.Status400BadRequest,
            };
        };
    });
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
});

builder.Services
    .AddIdentity<User, Role>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireDigit = true;
        options.Password.RequiredLength = 8;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.Cookie.SameSite = builder.Environment.IsDevelopment()
        ? SameSiteMode.Lax
        : SameSiteMode.Strict;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

var jwtSigningKey = builder.Configuration["Jwt:SigningKey"];
if (string.IsNullOrWhiteSpace(jwtSigningKey))
{
    throw new InvalidOperationException("JWT signing key is not configured.");
}

var jwtKey = Encoding.UTF8.GetBytes(jwtSigningKey);

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(jwtKey),
            ClockSkew = TimeSpan.Zero,
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Headers.Authorization.FirstOrDefault()?.Split(' ').Last();

                if (string.IsNullOrEmpty(token))
                {
                    token = context.Request.Cookies["Token"];
                }

                if (!string.IsNullOrEmpty(token))
                {
                    context.Token = token;
                    context.HttpContext.Items["AccessToken"] = token;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var userIdClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return;
                }

                var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var isActive = await dbContext.Users
                    .Where(u => u.Id == userId)
                    .Select(u => (bool?)u.IsActive)
                    .FirstOrDefaultAsync();

                if (isActive != true)
                {
                    context.Fail("User account is inactive.");
                    return;
                }

                if (context.HttpContext.Items["AccessToken"] is string accessToken)
                {
                    var isRevoked = await dbContext.Tokens
                        .AsNoTracking()
                        .AnyAsync(t => t.Value == accessToken && t.RevokedAtUtc != null);

                    if (isRevoked)
                    {
                        context.Fail("Token has been revoked.");
                    }
                }
            },
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ApplicationSettings>();

builder.Services.AddScoped<IImageProcessor, ImageSharpImageProcessor>();
builder.Services.AddScoped<IBlobStorageService, AzureBlobStorageService>();
builder.Services.AddScoped<IPhotoUrlResolver, PhotoUrlResolver>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IExerciseService, ExerciseService>();
builder.Services.AddScoped<IMuscleGroupService, MuscleGroupService>();
builder.Services.AddScoped<IWorkoutService, WorkoutService>();
builder.Services.AddScoped<IWorkoutTemplateService, WorkoutTemplateService>();
builder.Services.AddScoped<IProgramPlanScheduleService, ProgramPlanScheduleService>();
builder.Services.AddScoped<IProgramPlanService, ProgramPlanService>();
builder.Services.AddScoped<IProgramPlanDayService, ProgramPlanDayService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IBodyMetricService, BodyMetricService>();
builder.Services.AddScoped<ITrainingProfileService, TrainingProfileService>();
builder.Services.AddScoped<IAdminErrorService, AdminErrorService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

if (!app.Environment.IsEnvironment("Testing"))
{
    app.MigrateDatabase();
    await app.SeedDatabase();
}

app.MapControllers();
app.Run();

public partial class Program
{
}
