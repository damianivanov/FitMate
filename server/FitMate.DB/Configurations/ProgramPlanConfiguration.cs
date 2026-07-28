using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ProgramPlanConfiguration : BaseConfiguration<ProgramPlan>
{
    public override void Configure(EntityTypeBuilder<ProgramPlan> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.Description)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => x.StartDate);
        builder.HasIndex(x => x.EndDate);
    }
}
