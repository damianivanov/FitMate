using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddUnsupportedAIRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnsupportedAIRequests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    MessageId = table.Column<long>(type: "bigint", nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    RequestedFunctionality = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UserIntentSummary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SuggestedFallback = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OccurrenceCount = table.Column<int>(type: "integer", nullable: false),
                    FirstRequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastRequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    AdminNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ExternalTrackingUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ExternalTrackingKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnsupportedAIRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UnsupportedAIRequestOccurrences",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UnsupportedAIRequestId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    MessageId = table.Column<long>(type: "bigint", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnsupportedAIRequestOccurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UnsupportedAIRequestOccurrences_UnsupportedAIRequests_Unsup~",
                        column: x => x.UnsupportedAIRequestId,
                        principalTable: "UnsupportedAIRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnsupportedAIRequestOccurrences_UnsupportedAIRequestId",
                table: "UnsupportedAIRequestOccurrences",
                column: "UnsupportedAIRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_UnsupportedAIRequestOccurrences_UserId",
                table: "UnsupportedAIRequestOccurrences",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UnsupportedAIRequests_Category_NormalizedKey",
                table: "UnsupportedAIRequests",
                columns: new[] { "Category", "NormalizedKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnsupportedAIRequests_LastRequestedAt",
                table: "UnsupportedAIRequests",
                column: "LastRequestedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UnsupportedAIRequests_Status",
                table: "UnsupportedAIRequests",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnsupportedAIRequestOccurrences");

            migrationBuilder.DropTable(
                name: "UnsupportedAIRequests");
        }
    }
}
