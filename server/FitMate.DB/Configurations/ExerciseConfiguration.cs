using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ExerciseConfiguration : BaseConfiguration<Exercise>
{
    public override void Configure(EntityTypeBuilder<Exercise> builder)
    {
        base.Configure(builder);

        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.DateCreated);

        builder.HasOne(x => x.User)
            .WithMany(x => x.Exercises)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.PrimaryMuscleGroup)
            .WithMany(x => x.PrimaryExercises)
            .HasForeignKey(x => x.PrimaryMuscleGroupId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.SecondaryMuscleGroup)
            .WithMany(x => x.SecondaryExercises)
            .HasForeignKey(x => x.SecondaryMuscleGroupId)
            .OnDelete(DeleteBehavior.NoAction)
            .IsRequired(false);
    }
}
