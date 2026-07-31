using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIActionConfiguration : IEntityTypeConfiguration<AIAction>
{
    public void Configure(EntityTypeBuilder<AIAction> builder)
    {
        builder.Property(x => x.PayloadJson).HasColumnType("jsonb");
        builder.Property(x => x.ResultJson).HasColumnType("jsonb");
        builder.Property(x => x.ValidationSummaryJson).HasColumnType("jsonb");
        builder.Property(x => x.FailureReason).HasMaxLength(2000);
        builder.Property(x => x.Version).IsConcurrencyToken();

        builder.HasOne(x => x.Conversation)
            .WithMany()
            .HasForeignKey(x => x.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => x.ConversationId);
        builder.HasIndex(x => new { x.Status, x.ExpiresAt });
    }
}
