using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIModelPricingConfiguration : IEntityTypeConfiguration<AIModelPricing>
{
    public void Configure(EntityTypeBuilder<AIModelPricing> builder)
    {
        builder.Property(x => x.Provider).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Model).HasMaxLength(100).IsRequired();
        builder.Property(x => x.InputCostPerMillionTokens).HasPrecision(18, 6);
        builder.Property(x => x.CachedInputCostPerMillionTokens).HasPrecision(18, 6);
        builder.Property(x => x.OutputCostPerMillionTokens).HasPrecision(18, 6);
        builder.Property(x => x.ImageCostPerGeneration).HasPrecision(18, 6);

        builder.HasIndex(x => new { x.Provider, x.Model, x.EffectiveFrom });
    }
}
