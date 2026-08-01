using FitMate.DB.Entities;
using FitMate.DB.Entities.Base;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FitMate.DB;

public class AppDbContext : IdentityDbContext<User, Role, long>, IDataProtectionKeyContext
{
    // The data-protection key ring lives in the database, not on disk: the app runs in a container
    // with an ephemeral filesystem, so file-backed keys are regenerated on every deploy and any
    // payload protected with the previous ring (Identity password-reset tokens) stops validating.
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<Error> Errors => Set<Error>();
    public DbSet<Token> Tokens => Set<Token>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<ExerciseAlias> ExerciseAliases => Set<ExerciseAlias>();
    public DbSet<ExerciseSet> ExerciseSets => Set<ExerciseSet>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<Workout> Workouts => Set<Workout>();
    public DbSet<WorkoutTemplate> WorkoutTemplates => Set<WorkoutTemplate>();
    public DbSet<UserBodyMetric> UserBodyMetrics => Set<UserBodyMetric>();
    public DbSet<MuscleGroup> MuscleGroups => Set<MuscleGroup>();
    public DbSet<TemplateExercise> TemplateExercises => Set<TemplateExercise>();
    public DbSet<TemplateExerciseSet> TemplateExerciseSets => Set<TemplateExerciseSet>();
    public DbSet<TemplateExerciseGroup> TemplateExerciseGroups => Set<TemplateExerciseGroup>();
    public DbSet<WorkoutExerciseGroup> WorkoutExerciseGroups => Set<WorkoutExerciseGroup>();
    public DbSet<PersonalRecord> PersonalRecords => Set<PersonalRecord>();
    public DbSet<ProgramPlan> ProgramPlans => Set<ProgramPlan>();
    public DbSet<ProgramPlanScheduleRule> ProgramPlanScheduleRules => Set<ProgramPlanScheduleRule>();
    public DbSet<ProgramPlanDay> ProgramPlanDays => Set<ProgramPlanDay>();
    public DbSet<UserTrainingProfile> UserTrainingProfiles => Set<UserTrainingProfile>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<PlanPrice> PlanPrices => Set<PlanPrice>();
    public DbSet<PlanEntitlement> PlanEntitlements => Set<PlanEntitlement>();
    public DbSet<UserSubscription> UserSubscriptions => Set<UserSubscription>();
    public DbSet<UserPlanOverride> UserPlanOverrides => Set<UserPlanOverride>();
    public DbSet<UsageBucket> UsageBuckets => Set<UsageBucket>();
    public DbSet<UsageEntry> UsageEntries => Set<UsageEntry>();
    public DbSet<UsageReservation> UsageReservations => Set<UsageReservation>();
    public DbSet<AIConversation> AIConversations => Set<AIConversation>();
    public DbSet<AIMessage> AIMessages => Set<AIMessage>();
    public DbSet<AIRun> AIRuns => Set<AIRun>();
    public DbSet<AIToolExecution> AIToolExecutions => Set<AIToolExecution>();
    public DbSet<UserAIPreferences> UserAIPreferences => Set<UserAIPreferences>();
    public DbSet<AIModelPricing> AIModelPricings => Set<AIModelPricing>();
    public DbSet<AISettings> AISettings => Set<AISettings>();
    public DbSet<AIAction> AIActions => Set<AIAction>();
    public DbSet<UnsupportedAIRequest> UnsupportedAIRequests => Set<UnsupportedAIRequest>();
    public DbSet<UnsupportedAIRequestOccurrence> UnsupportedAIRequestOccurrences => Set<UnsupportedAIRequestOccurrence>();

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public int SaveChanges(long? userId)
    {
        return SaveChanges(userId, acceptAllChangesOnSuccess: true);
    }

    public override int SaveChanges()
    {
        return SaveChanges(acceptAllChangesOnSuccess: true);
    }

    public int SaveChanges(long? userId, bool acceptAllChangesOnSuccess)
    {
        TrackUser(userId);
        return SaveChanges(acceptAllChangesOnSuccess);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        AddTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public Task<int> SaveChangesAsync(long? userId, CancellationToken cancellationToken = default)
    {
        return SaveChangesAsync(userId, acceptAllChangesOnSuccess: true, cancellationToken);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return SaveChangesAsync(acceptAllChangesOnSuccess: true, cancellationToken);
    }

    public Task<int> SaveChangesAsync(long? userId, bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        TrackUser(userId);
        return SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        AddTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    private void AddTimestamps()
    {
        var now = DateTime.UtcNow;
        var entries = ChangeTracker.Entries<IBaseEntity>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added && entry.Entity.DateCreated == default)
            {
                entry.Entity.DateCreated = now;
            }

            entry.Entity.DateModified = now;
        }
    }

    private void TrackUser(long? userId)
    {
        if (!userId.HasValue)
        {
            return;
        }

        var entries = ChangeTracker.Entries<IBaseTrackUserEntity>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedById = userId.Value;
            }

            entry.Entity.ModifiedById = userId.Value;
        }
    }
}
