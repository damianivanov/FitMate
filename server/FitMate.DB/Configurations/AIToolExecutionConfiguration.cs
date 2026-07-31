using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIToolExecutionConfiguration : IEntityTypeConfiguration<AIToolExecution>
{
    public void Configure(EntityTypeBuilder<AIToolExecution> builder)
    {
        builder.Property(x => x.ToolCallId).HasMaxLength(100);
        builder.Property(x => x.ToolName).HasMaxLength(100);
        builder.Property(x => x.ErrorCode).HasMaxLength(100);
        builder.Property(x => x.ErrorMessage).HasMaxLength(2000);

        builder.HasOne(x => x.AIRun)
            .WithMany(x => x.ToolExecutions)
            .HasForeignKey(x => x.AIRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.AIRunId);
        builder.HasIndex(x => x.ToolName);
    }
}
