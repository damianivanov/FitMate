using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UnsupportedAIRequestConfiguration : IEntityTypeConfiguration<UnsupportedAIRequest>
{
    public void Configure(EntityTypeBuilder<UnsupportedAIRequest> builder)
    {
        builder.Property(x => x.Category).HasMaxLength(100).IsRequired();
        builder.Property(x => x.NormalizedKey).HasMaxLength(500).IsRequired();
        builder.Property(x => x.RequestedFunctionality).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.UserIntentSummary).HasMaxLength(2000);
        builder.Property(x => x.SuggestedFallback).HasMaxLength(2000);
        builder.Property(x => x.AdminNotes).HasMaxLength(4000);
        builder.Property(x => x.ExternalTrackingUrl).HasMaxLength(1000);
        builder.Property(x => x.ExternalTrackingKey).HasMaxLength(100);

        builder.HasIndex(x => new { x.Category, x.NormalizedKey }).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.LastRequestedAt);
    }
}
