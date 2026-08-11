using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIProgressEventConfiguration : IEntityTypeConfiguration<AIProgressEvent>
{
    public void Configure(EntityTypeBuilder<AIProgressEvent> builder)
    {
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.ToolName).HasMaxLength(100);

        builder.HasOne(x => x.AIRun)
            .WithMany(x => x.ProgressEvents)
            .HasForeignKey(x => x.AIRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.AIRunId, x.Id });
    }
}
