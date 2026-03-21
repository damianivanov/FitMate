using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseSetType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SortOrderInGroup",
                table: "WorkoutExercises",
                newName: "OrderIndex");

            migrationBuilder.RenameIndex(
                name: "IX_WorkoutExercises_WorkoutExerciseGroupId_SortOrderInGroup",
                table: "WorkoutExercises",
                newName: "IX_WorkoutExercises_WorkoutExerciseGroupId_OrderIndex");

            migrationBuilder.RenameColumn(
                name: "SortOrderInGroup",
                table: "TemplateExercises",
                newName: "OrderIndex");

            migrationBuilder.RenameIndex(
                name: "IX_TemplateExercises_TemplateExerciseGroupId_SortOrderInGroup",
                table: "TemplateExercises",
                newName: "IX_TemplateExercises_TemplateExerciseGroupId_OrderIndex");

            migrationBuilder.RenameColumn(
                name: "SetNumber",
                table: "ExerciseSets",
                newName: "OrderIndex");

            migrationBuilder.RenameIndex(
                name: "IX_ExerciseSets_WorkoutExerciseId_SetNumber",
                table: "ExerciseSets",
                newName: "IX_ExerciseSets_WorkoutExerciseId_OrderIndex");

            migrationBuilder.AddColumn<bool>(
                name: "IsCompleted",
                table: "ExerciseSets",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "TemplateExerciseSets",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TemplateExerciseId = table.Column<long>(type: "bigint", nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    WeightKg = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: true),
                    Reps = table.Column<int>(type: "int", nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    DistanceMeters = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: true),
                    Rpe = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    RestSeconds = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateModified = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TemplateExerciseSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TemplateExerciseSets_TemplateExercises_TemplateExerciseId",
                        column: x => x.TemplateExerciseId,
                        principalTable: "TemplateExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TemplateExerciseSets_TemplateExerciseId_OrderIndex",
                table: "TemplateExerciseSets",
                columns: new[] { "TemplateExerciseId", "OrderIndex" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TemplateExerciseSets");

            migrationBuilder.DropColumn(
                name: "IsCompleted",
                table: "ExerciseSets");

            migrationBuilder.RenameColumn(
                name: "OrderIndex",
                table: "WorkoutExercises",
                newName: "SortOrderInGroup");

            migrationBuilder.RenameIndex(
                name: "IX_WorkoutExercises_WorkoutExerciseGroupId_OrderIndex",
                table: "WorkoutExercises",
                newName: "IX_WorkoutExercises_WorkoutExerciseGroupId_SortOrderInGroup");

            migrationBuilder.RenameColumn(
                name: "OrderIndex",
                table: "TemplateExercises",
                newName: "SortOrderInGroup");

            migrationBuilder.RenameIndex(
                name: "IX_TemplateExercises_TemplateExerciseGroupId_OrderIndex",
                table: "TemplateExercises",
                newName: "IX_TemplateExercises_TemplateExerciseGroupId_SortOrderInGroup");

            migrationBuilder.RenameColumn(
                name: "OrderIndex",
                table: "ExerciseSets",
                newName: "SetNumber");

            migrationBuilder.RenameIndex(
                name: "IX_ExerciseSets_WorkoutExerciseId_OrderIndex",
                table: "ExerciseSets",
                newName: "IX_ExerciseSets_WorkoutExerciseId_SetNumber");
        }
    }
}
