using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddDurableAIRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AttemptCount",
                table: "AIRuns",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ClientRequestId",
                table: "AIRuns",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExecutionBudgetJson",
                table: "AIRuns",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasSideEffects",
                table: "AIRuns",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "HeartbeatAt",
                table: "AIRuns",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LeaseExpiresAt",
                table: "AIRuns",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LeaseOwner",
                table: "AIRuns",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptAt",
                table: "AIRuns",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessingStartedAt",
                table: "AIRuns",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QueuedAt",
                table: "AIRuns",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "UsageReservationId",
                table: "AIRuns",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "AIRunId",
                table: "AIMessages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ActiveRunId",
                table: "AIConversations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                table: "AIConversations",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SummaryThroughMessageId",
                table: "AIConversations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SummaryUpdatedAt",
                table: "AIConversations",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AIProgressEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AIRunId = table.Column<long>(type: "bigint", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ToolName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AIProgressEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AIProgressEvents_AIRuns_AIRunId",
                        column: x => x.AIRunId,
                        principalTable: "AIRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Existing rows all default to an empty ClientRequestId, which collides under the unique
            // index below as soon as a user has more than one historical run. Give them distinct
            // values first; nothing ever looks these up, they only have to not collide.
            migrationBuilder.Sql(
                """UPDATE "AIRuns" SET "ClientRequestId" = 'legacy-' || "Id" WHERE "ClientRequestId" = '';""");

            migrationBuilder.CreateIndex(
                name: "IX_AIRuns_Status_NextAttemptAt_LeaseExpiresAt",
                table: "AIRuns",
                columns: new[] { "Status", "NextAttemptAt", "LeaseExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AIRuns_UserId_ClientRequestId",
                table: "AIRuns",
                columns: new[] { "UserId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AIMessages_AIRunId_Id",
                table: "AIMessages",
                columns: new[] { "AIRunId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_AIProgressEvents_AIRunId_Id",
                table: "AIProgressEvents",
                columns: new[] { "AIRunId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AIProgressEvents");

            migrationBuilder.DropIndex(
                name: "IX_AIRuns_Status_NextAttemptAt_LeaseExpiresAt",
                table: "AIRuns");

            migrationBuilder.DropIndex(
                name: "IX_AIRuns_UserId_ClientRequestId",
                table: "AIRuns");

            migrationBuilder.DropIndex(
                name: "IX_AIMessages_AIRunId_Id",
                table: "AIMessages");

            migrationBuilder.DropColumn(
                name: "AttemptCount",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "ClientRequestId",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "ExecutionBudgetJson",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "HasSideEffects",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "HeartbeatAt",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "LeaseExpiresAt",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "LeaseOwner",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "NextAttemptAt",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "ProcessingStartedAt",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "QueuedAt",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "UsageReservationId",
                table: "AIRuns");

            migrationBuilder.DropColumn(
                name: "AIRunId",
                table: "AIMessages");

            migrationBuilder.DropColumn(
                name: "ActiveRunId",
                table: "AIConversations");

            migrationBuilder.DropColumn(
                name: "Summary",
                table: "AIConversations");

            migrationBuilder.DropColumn(
                name: "SummaryThroughMessageId",
                table: "AIConversations");

            migrationBuilder.DropColumn(
                name: "SummaryUpdatedAt",
                table: "AIConversations");
        }
    }
}
