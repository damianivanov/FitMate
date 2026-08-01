using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AISettingsConfiguration : IEntityTypeConfiguration<AISettings>
{
    public void Configure(EntityTypeBuilder<AISettings> builder)
    {
        builder.Property(x => x.DefaultModel).HasMaxLength(100);
        builder.Property(x => x.FastModel).HasMaxLength(100);
        builder.Property(x => x.ReasoningModel).HasMaxLength(100);
        builder.Property(x => x.VisionModel).HasMaxLength(100);
        builder.Property(x => x.ImageModel).HasMaxLength(100);
    }
}
