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
        builder.HasIndex(x => x.Name).IsUnique();
    }
}
