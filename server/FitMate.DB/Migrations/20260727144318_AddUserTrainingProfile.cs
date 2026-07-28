using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTrainingProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserTrainingProfiles",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Goal = table.Column<int>(type: "integer", nullable: false),
                    ExperienceLevel = table.Column<int>(type: "integer", nullable: false),
                    PreferredTrainingDaysPerWeek = table.Column<int>(type: "integer", nullable: false),
                    PreferredWorkoutDurationMinutes = table.Column<int>(type: "integer", nullable: true),
                    WeightUnit = table.Column<int>(type: "integer", nullable: false),
                    AvailableEquipmentJson = table.Column<string>(type: "jsonb", nullable: true),
                    PreferredTrainingDaysJson = table.Column<string>(type: "jsonb", nullable: true),
                    ExerciseRestrictions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AdditionalPreferences = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AllowAiPersonalization = table.Column<bool>(type: "boolean", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTrainingProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTrainingProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTrainingProfiles_UserId",
                table: "UserTrainingProfiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserTrainingProfiles");
        }
    }
}
