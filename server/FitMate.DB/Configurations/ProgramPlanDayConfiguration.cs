using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ProgramPlanDayConfiguration : BaseConfiguration<ProgramPlanDay>
{
    public override void Configure(EntityTypeBuilder<ProgramPlanDay> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Notes)
            .HasMaxLength(1000)
            .IsRequired(false);

        builder.HasOne(x => x.ProgramPlan)
            .WithMany(x => x.Days)
            .HasForeignKey(x => x.ProgramPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany()
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        builder.HasOne(x => x.StartedWorkout)
            .WithMany()
            .HasForeignKey(x => x.StartedWorkoutId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        builder.HasOne(x => x.CompletedWorkout)
            .WithMany()
            .HasForeignKey(x => x.CompletedWorkoutId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        builder.HasIndex(x => new { x.ProgramPlanId, x.ScheduledDate, x.OrderIndex }).IsUnique();
        builder.HasIndex(x => new { x.ProgramPlanId, x.Status });
    }
}
