using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.Property(x => x.AvatarUrl)
            .HasMaxLength(2048)
            .IsRequired(false);

        builder.Property(x => x.FirstName)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(x => x.LastName)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(x => x.GoogleId)
            .HasMaxLength(256)
            .IsRequired(false);

        builder.HasIndex(x => x.GoogleId)
            .IsUnique()
            .HasFilter("[GoogleId] IS NOT NULL");

        builder.Property(x => x.IsActive)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(x => x.LastLoginAt)
            .IsRequired(false);
    }
}
