using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class PersonalRecordConfiguration : BaseConfiguration<PersonalRecord>
{
    public override void Configure(EntityTypeBuilder<PersonalRecord> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Value)
            .HasPrecision(12, 2);

        builder.HasIndex(x => new { x.UserId, x.ExerciseId, x.RecordType, x.IsCurrent });

        builder.HasOne(x => x.User)
            .WithMany(x => x.PersonalRecords)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.Exercise)
            .WithMany(x => x.PersonalRecords)
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.ExerciseSet)
            .WithMany(x => x.PersonalRecords)
            .HasForeignKey(x => x.ExerciseSetId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);
    }
}
