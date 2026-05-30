using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddTemplateExerciseSetType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill existing template sets to Working (ExerciseSetType has no 0 member).
            migrationBuilder.AddColumn<int>(
                name: "SetType",
                table: "TemplateExerciseSets",
                type: "int",
                nullable: false,
                defaultValue: 2);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SetType",
                table: "TemplateExerciseSets");
        }
    }
}
