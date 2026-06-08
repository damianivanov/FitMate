using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class TemplateExerciseSetConfiguration : BaseConfiguration<TemplateExerciseSet>
{
    public override void Configure(EntityTypeBuilder<TemplateExerciseSet> builder)
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

        builder.Property(x => x.Notes)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.HasIndex(x => new { x.TemplateExerciseId, x.OrderIndex })
            .IsUnique();

        builder.HasOne(x => x.TemplateExercise)
            .WithMany(x => x.Sets)
            .HasForeignKey(x => x.TemplateExerciseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
