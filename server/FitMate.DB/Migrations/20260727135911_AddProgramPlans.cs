using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddProgramPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ProgramPlanDayId",
                table: "Workouts",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProgramPlans",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Goal = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ScheduleType = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TargetWorkoutsPerWeek = table.Column<int>(type: "integer", nullable: false),
                    IsAiGenerated = table.Column<bool>(type: "boolean", nullable: false),
                    SourceAiActionId = table.Column<long>(type: "bigint", nullable: true),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramPlans_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgramPlanDays",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProgramPlanId = table.Column<long>(type: "bigint", nullable: false),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    OriginalScheduledDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DayType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    WorkoutTemplateId = table.Column<long>(type: "bigint", nullable: true),
                    StartedWorkoutId = table.Column<long>(type: "bigint", nullable: true),
                    CompletedWorkoutId = table.Column<long>(type: "bigint", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramPlanDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramPlanDays_ProgramPlans_ProgramPlanId",
                        column: x => x.ProgramPlanId,
                        principalTable: "ProgramPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProgramPlanDays_WorkoutTemplates_WorkoutTemplateId",
                        column: x => x.WorkoutTemplateId,
                        principalTable: "WorkoutTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgramPlanDays_Workouts_CompletedWorkoutId",
                        column: x => x.CompletedWorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ProgramPlanDays_Workouts_StartedWorkoutId",
                        column: x => x.StartedWorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProgramPlanScheduleRules",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProgramPlanId = table.Column<long>(type: "bigint", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: true),
                    RotationDayIndex = table.Column<int>(type: "integer", nullable: true),
                    DayType = table.Column<int>(type: "integer", nullable: false),
                    WorkoutTemplateId = table.Column<long>(type: "bigint", nullable: true),
                    WeekInterval = table.Column<int>(type: "integer", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    IsOptional = table.Column<bool>(type: "boolean", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramPlanScheduleRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramPlanScheduleRules_ProgramPlans_ProgramPlanId",
                        column: x => x.ProgramPlanId,
                        principalTable: "ProgramPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProgramPlanScheduleRules_WorkoutTemplates_WorkoutTemplateId",
                        column: x => x.WorkoutTemplateId,
                        principalTable: "WorkoutTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_ProgramPlanDayId",
                table: "Workouts",
                column: "ProgramPlanDayId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanDays_CompletedWorkoutId",
                table: "ProgramPlanDays",
                column: "CompletedWorkoutId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanDays_ProgramPlanId_ScheduledDate_OrderIndex",
                table: "ProgramPlanDays",
                columns: new[] { "ProgramPlanId", "ScheduledDate", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanDays_ProgramPlanId_Status",
                table: "ProgramPlanDays",
                columns: new[] { "ProgramPlanId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanDays_StartedWorkoutId",
                table: "ProgramPlanDays",
                column: "StartedWorkoutId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanDays_WorkoutTemplateId",
                table: "ProgramPlanDays",
                column: "WorkoutTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlans_EndDate",
                table: "ProgramPlans",
                column: "EndDate");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlans_StartDate",
                table: "ProgramPlans",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlans_UserId",
                table: "ProgramPlans",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlans_UserId_Status",
                table: "ProgramPlans",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanScheduleRules_ProgramPlanId",
                table: "ProgramPlanScheduleRules",
                column: "ProgramPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramPlanScheduleRules_WorkoutTemplateId",
                table: "ProgramPlanScheduleRules",
                column: "WorkoutTemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_Workouts_ProgramPlanDays_ProgramPlanDayId",
                table: "Workouts",
                column: "ProgramPlanDayId",
                principalTable: "ProgramPlanDays",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Workouts_ProgramPlanDays_ProgramPlanDayId",
                table: "Workouts");

            migrationBuilder.DropTable(
                name: "ProgramPlanDays");

            migrationBuilder.DropTable(
                name: "ProgramPlanScheduleRules");

            migrationBuilder.DropTable(
                name: "ProgramPlans");

            migrationBuilder.DropIndex(
                name: "IX_Workouts_ProgramPlanDayId",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "ProgramPlanDayId",
                table: "Workouts");
        }
    }
}
