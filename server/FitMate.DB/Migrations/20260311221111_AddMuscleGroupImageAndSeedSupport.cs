using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddMuscleGroupImageAndSeedSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "MuscleGroups",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "MuscleGroups");
        }
    }
}
