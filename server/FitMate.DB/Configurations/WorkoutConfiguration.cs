using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class WorkoutConfiguration : BaseConfiguration<Workout>
{
    public override void Configure(EntityTypeBuilder<Workout> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.TotalVolumeKg)
            .HasPrecision(12, 2)
            .IsRequired(false);

        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.WorkoutTemplateId);
        builder.HasIndex(x => x.StartedAt);

        builder.HasOne(x => x.User)
            .WithMany(x => x.Workouts)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany(x => x.Workouts)
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);
    }
}
