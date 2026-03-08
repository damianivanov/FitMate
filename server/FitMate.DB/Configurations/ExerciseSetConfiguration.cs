using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ExerciseSetConfiguration : BaseConfiguration<ExerciseSet>
{
    public override void Configure(EntityTypeBuilder<ExerciseSet> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.WeightKg)
            .HasPrecision(8, 2)
            .IsRequired(false);

        builder.Property(x => x.DistanceMeters)
            .HasPrecision(8, 2)
            .IsRequired(false);

        builder.Property(x => x.Rpe)
            .HasPrecision(3, 1)
            .IsRequired(false);

        builder.HasIndex(x => new { x.WorkoutExerciseId, x.SetNumber }).IsUnique();

        builder.HasOne(x => x.WorkoutExercise)
            .WithMany(x => x.Sets)
            .HasForeignKey(x => x.WorkoutExerciseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
