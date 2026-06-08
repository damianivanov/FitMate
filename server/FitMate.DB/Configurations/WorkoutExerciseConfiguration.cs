using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class WorkoutExerciseConfiguration : BaseConfiguration<WorkoutExercise>
{
    public override void Configure(EntityTypeBuilder<WorkoutExercise> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Notes)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.HasIndex(x => new { x.WorkoutExerciseGroupId, x.OrderIndex })
            .IsUnique();

        builder.HasOne(x => x.WorkoutExerciseGroup)
            .WithMany(x => x.Exercises)
            .HasForeignKey(x => x.WorkoutExerciseGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Exercise)
            .WithMany(x => x.WorkoutExercises)
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
