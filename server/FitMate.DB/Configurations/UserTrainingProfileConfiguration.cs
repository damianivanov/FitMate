using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class UserTrainingProfileConfiguration : BaseConfiguration<UserTrainingProfile>
{
    public override void Configure(EntityTypeBuilder<UserTrainingProfile> builder)
    {
        base.Configure(builder);

        // jsonb on Npgsql; Sqlite tests store the same string with TEXT affinity.
        builder.Property(x => x.AvailableEquipmentJson).HasColumnType("jsonb");
        builder.Property(x => x.PreferredTrainingDaysJson).HasColumnType("jsonb");
        builder.Property(x => x.ExerciseRestrictions).HasMaxLength(2000);
        builder.Property(x => x.AdditionalPreferences).HasMaxLength(2000);

        builder.HasIndex(x => x.UserId).IsUnique();   // one profile per user

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
