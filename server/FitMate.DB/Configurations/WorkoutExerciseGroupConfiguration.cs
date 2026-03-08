using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class WorkoutExerciseGroupConfiguration : BaseConfiguration<WorkoutExerciseGroup>
{
    public override void Configure(EntityTypeBuilder<WorkoutExerciseGroup> builder)
    {
        base.Configure(builder);

        builder.HasIndex(x => new { x.WorkoutId, x.SortOrder }).IsUnique();

        builder.HasOne(x => x.Workout)
            .WithMany(x => x.ExerciseGroups)
            .HasForeignKey(x => x.WorkoutId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
