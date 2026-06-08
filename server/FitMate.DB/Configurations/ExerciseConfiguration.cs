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

        builder.Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Slug)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Description)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.Property(x => x.ImageUrl)
            .HasMaxLength(2048)
            .IsRequired(false);

        builder.Property(x => x.VideoUrl)
            .HasMaxLength(2048)
            .IsRequired(false);

        builder.Property(x => x.IsPublic).HasDefaultValue(true);

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
