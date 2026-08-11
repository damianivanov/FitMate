using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitMate.DB.Migrations
{
    /// <inheritdoc />
    public partial class RaiseConversationMessageCeiling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The stored global is a hard ceiling that plans can only lower, so leaving it at the old
            // default of 30 silently capped the Pro plan's 50. Only rows still sitting at that exact
            // default are moved; a value an admin deliberately chose is left alone.
            migrationBuilder.Sql(
                """UPDATE "AISettings" SET "MaximumConversationMessages" = 50 WHERE "MaximumConversationMessages" = 30;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """UPDATE "AISettings" SET "MaximumConversationMessages" = 30 WHERE "MaximumConversationMessages" = 50;""");
        }
    }
}
