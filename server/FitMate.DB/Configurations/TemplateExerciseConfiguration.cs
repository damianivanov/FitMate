using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class TemplateExerciseConfiguration : BaseConfiguration<TemplateExercise>
{
    public override void Configure(EntityTypeBuilder<TemplateExercise> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.TargetWeightKg)
            .HasPrecision(8, 2)
            .IsRequired(false);

        builder.Property(x => x.TargetReps)
            .HasMaxLength(50)
            .IsRequired(false);

        builder.Property(x => x.Tempo)
            .HasMaxLength(20)
            .IsRequired(false);

        builder.Property(x => x.Notes)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.HasIndex(x => new { x.TemplateExerciseGroupId, x.OrderIndex })
            .IsUnique();

        builder.HasOne(x => x.TemplateExerciseGroup)
            .WithMany(x => x.Exercises)
            .HasForeignKey(x => x.TemplateExerciseGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Exercise)
            .WithMany(x => x.TemplateExercises)
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
