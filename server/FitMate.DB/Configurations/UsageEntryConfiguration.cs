using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UsageEntryConfiguration : IEntityTypeConfiguration<UsageEntry>
{
    public void Configure(EntityTypeBuilder<UsageEntry> builder)
    {
        builder.Property(x => x.ReferenceType).HasMaxLength(100);
        builder.HasIndex(x => new { x.UserId, x.Feature });
        builder.HasIndex(x => x.UsageReservationId);
    }
}
