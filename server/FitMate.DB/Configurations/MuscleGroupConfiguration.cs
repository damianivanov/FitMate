using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class MuscleGroupConfiguration : BaseConfiguration<MuscleGroup>
{
    public override void Configure(EntityTypeBuilder<MuscleGroup> builder)
    {
        base.Configure(builder);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ImageUrl).HasMaxLength(2048).IsRequired(false);
        builder.HasIndex(x => x.Name).IsUnique();
    }
}
