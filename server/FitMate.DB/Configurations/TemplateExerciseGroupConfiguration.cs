using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class TemplateExerciseGroupConfiguration : BaseConfiguration<TemplateExerciseGroup>
{
    public override void Configure(EntityTypeBuilder<TemplateExerciseGroup> builder)
    {
        base.Configure(builder);

        builder.HasIndex(x => new { x.WorkoutTemplateId, x.SortOrder })
            .IsUnique();

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany(x => x.ExerciseGroups)
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
