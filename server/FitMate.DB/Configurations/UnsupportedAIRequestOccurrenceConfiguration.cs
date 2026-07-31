using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UnsupportedAIRequestOccurrenceConfiguration : IEntityTypeConfiguration<UnsupportedAIRequestOccurrence>
{
    public void Configure(EntityTypeBuilder<UnsupportedAIRequestOccurrence> builder)
    {
        builder.HasOne(x => x.UnsupportedAIRequest)
            .WithMany(x => x.Occurrences)
            .HasForeignKey(x => x.UnsupportedAIRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.UnsupportedAIRequestId);
        builder.HasIndex(x => x.UserId);
    }
}
