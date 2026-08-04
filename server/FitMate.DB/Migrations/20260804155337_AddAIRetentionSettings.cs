using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddAIRetentionSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ConversationRetentionDays",
                table: "AISettings",
                type: "integer",
                nullable: false,
                defaultValue: 365);

            migrationBuilder.AddColumn<int>(
                name: "ExpiredActionRetentionDays",
                table: "AISettings",
                type: "integer",
                nullable: false,
                defaultValue: 90);

            migrationBuilder.AddColumn<int>(
                name: "OperationalLogRetentionDays",
                table: "AISettings",
                type: "integer",
                nullable: false,
                defaultValue: 180);

            migrationBuilder.AddColumn<int>(
                name: "TemporaryUploadRetentionHours",
                table: "AISettings",
                type: "integer",
                nullable: false,
                defaultValue: 24);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConversationRetentionDays",
                table: "AISettings");

            migrationBuilder.DropColumn(
                name: "ExpiredActionRetentionDays",
                table: "AISettings");

            migrationBuilder.DropColumn(
                name: "OperationalLogRetentionDays",
                table: "AISettings");

            migrationBuilder.DropColumn(
                name: "TemporaryUploadRetentionHours",
                table: "AISettings");
        }
    }
}
