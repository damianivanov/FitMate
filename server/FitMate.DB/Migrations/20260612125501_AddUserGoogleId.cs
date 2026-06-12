using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class AddUserGoogleId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GoogleId",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_GoogleId",
                table: "AspNetUsers",
                column: "GoogleId",
                unique: true,
                filter: "[GoogleId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_GoogleId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "GoogleId",
                table: "AspNetUsers");
        }
    }
}
