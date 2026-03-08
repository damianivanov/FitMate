using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class WorkoutTemplateConfiguration : BaseConfiguration<WorkoutTemplate>
{
    public override void Configure(EntityTypeBuilder<WorkoutTemplate> builder)
    {
        base.Configure(builder);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.DateCreated);

        builder.HasOne(x => x.User)
            .WithMany(x => x.WorkoutTemplates)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
