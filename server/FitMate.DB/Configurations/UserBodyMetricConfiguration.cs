using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class UserBodyMetricConfiguration : BaseConfiguration<UserBodyMetric>
{
    public override void Configure(EntityTypeBuilder<UserBodyMetric> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.BodyWeightKg)
            .HasPrecision(6, 2)
            .IsRequired(false);

        builder.Property(x => x.BodyFatPercentage)
            .HasPrecision(5, 2)
            .IsRequired(false);

        builder.Property(x => x.Notes)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.HasIndex(x => new { x.UserId, x.DateCreated });

        builder.HasOne(x => x.User)
            .WithMany(x => x.BodyMetrics)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
