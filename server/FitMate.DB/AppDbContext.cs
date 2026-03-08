using FitMate.DB.Entities;
using FitMate.DB.Entities.Base;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FitMate.DB;

public class AppDbContext : IdentityDbContext<User, Role, long>
{
    public DbSet<Error> Errors => Set<Error>();
    public DbSet<Token> Tokens => Set<Token>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

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
