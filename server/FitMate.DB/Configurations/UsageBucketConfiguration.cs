using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UsageBucketConfiguration : IEntityTypeConfiguration<UsageBucket>
{
    public void Configure(EntityTypeBuilder<UsageBucket> builder)
    {
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasIndex(x => new { x.UserId, x.Feature, x.PeriodStart, x.PeriodEnd }).IsUnique();
    }
}
