using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UserPlanOverrideConfiguration : IEntityTypeConfiguration<UserPlanOverride>
{
    public void Configure(EntityTypeBuilder<UserPlanOverride> builder)
    {
        builder.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        builder.Property(x => x.PreviousPlanCode).HasMaxLength(50);

        builder.HasOne(x => x.Plan)
            .WithMany()
            .HasForeignKey(x => x.PlanId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.UserId, x.IsActive });
    }
}
