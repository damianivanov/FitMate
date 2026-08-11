using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIRunConfiguration : IEntityTypeConfiguration<AIRun>
{
    public void Configure(EntityTypeBuilder<AIRun> builder)
    {
        builder.Property(x => x.Provider).HasMaxLength(50);
        builder.Property(x => x.Model).HasMaxLength(100);
        builder.Property(x => x.PromptVersion).HasMaxLength(50);
        builder.Property(x => x.ProviderRequestId).HasMaxLength(200);
        builder.Property(x => x.ErrorCode).HasMaxLength(100);
        builder.Property(x => x.ErrorMessage).HasMaxLength(2000);
        builder.Property(x => x.EstimatedCost).HasPrecision(18, 6);

        builder.HasOne(x => x.Conversation)
            .WithMany()
            .HasForeignKey(x => x.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.ClientRequestId).HasMaxLength(64);
        builder.Property(x => x.LeaseOwner).HasMaxLength(100);
        builder.Property(x => x.ExecutionBudgetJson).HasColumnType("jsonb");

        builder.HasIndex(x => new { x.UserId, x.StartedAt });
        builder.HasIndex(x => x.ConversationId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.StartedAt);

        builder.HasIndex(x => new { x.UserId, x.ClientRequestId }).IsUnique();
        builder.HasIndex(x => new { x.Status, x.NextAttemptAt, x.LeaseExpiresAt });
    }
}
