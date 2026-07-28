using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ProgramPlanScheduleRuleConfiguration : BaseConfiguration<ProgramPlanScheduleRule>
{
    public override void Configure(EntityTypeBuilder<ProgramPlanScheduleRule> builder)
    {
        base.Configure(builder);

        builder.HasOne(x => x.ProgramPlan)
            .WithMany(x => x.ScheduleRules)
            .HasForeignKey(x => x.ProgramPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany()
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        builder.HasIndex(x => x.ProgramPlanId);
    }
}
