using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UsageReservationConfiguration : IEntityTypeConfiguration<UsageReservation>
{
    public void Configure(EntityTypeBuilder<UsageReservation> builder)
    {
        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => new { x.Status, x.ExpiresAt });
    }
}
