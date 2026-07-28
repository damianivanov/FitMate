using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ExerciseAliasConfiguration : BaseConfiguration<ExerciseAlias>
{
    public override void Configure(EntityTypeBuilder<ExerciseAlias> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Alias)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.NormalizedAlias)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasOne(x => x.Exercise)
            .WithMany(x => x.Aliases)
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.NormalizedAlias);
        builder.HasIndex(x => new { x.ExerciseId, x.NormalizedAlias }).IsUnique();
    }
}
