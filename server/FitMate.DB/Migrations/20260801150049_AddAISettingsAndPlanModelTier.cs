using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddAISettingsAndPlanModelTier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AIModelTier",
                table: "Plans",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AISettings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DefaultModel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FastModel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReasoningModel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    VisionModel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ImageModel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TimeoutSeconds = table.Column<int>(type: "integer", nullable: false),
                    MaximumToolIterations = table.Column<int>(type: "integer", nullable: false),
                    MaximumToolCallsPerRun = table.Column<int>(type: "integer", nullable: false),
                    MaximumConversationMessages = table.Column<int>(type: "integer", nullable: false),
                    MaximumContextTokens = table.Column<int>(type: "integer", nullable: false),
                    MaximumOutputTokens = table.Column<int>(type: "integer", nullable: false),
                    MaximumMessageCharacters = table.Column<int>(type: "integer", nullable: false),
                    StoreRawProviderPayload = table.Column<bool>(type: "boolean", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DateModified = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AISettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AISettings");

            migrationBuilder.DropColumn(
                name: "AIModelTier",
                table: "Plans");
        }
    }
}
