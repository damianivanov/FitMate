using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseMetadataAndAliases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Exercises",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Difficulty",
                table: "Exercises",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Equipment",
                table: "Exercises",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MovementPattern",
                table: "Exercises",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExerciseAliases",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExerciseId = table.Column<long>(type: "bigint", nullable: false),
                    Alias = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalizedAlias = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseAliases_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseAliases_ExerciseId_NormalizedAlias",
                table: "ExerciseAliases",
                columns: new[] { "ExerciseId", "NormalizedAlias" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseAliases_NormalizedAlias",
                table: "ExerciseAliases",
                column: "NormalizedAlias");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExerciseAliases");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "Difficulty",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "Equipment",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "MovementPattern",
                table: "Exercises");
        }
    }
}
