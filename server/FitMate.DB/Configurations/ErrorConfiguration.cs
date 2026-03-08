using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ErrorConfiguration : IEntityTypeConfiguration<Error>
{
    public void Configure(EntityTypeBuilder<Error> builder)
    {
        builder.Property(x => x.Source).HasMaxLength(512);
        builder.Property(x => x.Action).HasMaxLength(1024);
        builder.Property(x => x.RequestUrl).HasMaxLength(2048);
        builder.Property(x => x.UserAgent).HasMaxLength(1024);
        builder.Property(x => x.Message).HasMaxLength(4000);

        builder.HasIndex(x => x.DateCreated);

        builder.HasOne(x => x.CreatedBy)
            .WithMany()
            .HasForeignKey(x => x.CreatedById)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(x => x.ModifiedBy)
            .WithMany()
            .HasForeignKey(x => x.ModifiedById)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
