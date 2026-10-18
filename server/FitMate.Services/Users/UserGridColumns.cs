using FitMate.Core.JsonModels.Users;
using FitMate.Services.Grids;

namespace FitMate.Services.Users;

internal static class UserGridColumns
{
    public static readonly IReadOnlyList<GridColumn<AdminUserModel>> All =
    [
        GridColumn<AdminUserModel>.Create("email", x => x.Email),
        GridColumn<AdminUserModel>.Create("name",
            x => ((x.FirstName ?? "") + " " + (x.LastName ?? "")).Trim()),
        GridColumn<AdminUserModel>.Create("isAdmin", x => x.IsAdmin,
            value => value ? "Admin" : "Member"),
        GridColumn<AdminUserModel>.Create("isActive", x => x.IsActive,
            value => value ? "Active" : "Inactive"),
        GridColumn<AdminUserModel>.Create("effectivePlanName", x => x.EffectivePlanName),
        GridColumn<AdminUserModel>.Create("dateCreated", x => x.DateCreated.Date,
            value => value.ToString("yyyy-MM-dd")),
        GridColumn<AdminUserModel>.Create("lastLoginAt", x => x.LastLoginAt.HasValue
            ? (DateTime?)x.LastLoginAt.Value.Date : null,
            value => value?.ToString("yyyy-MM-dd") ?? "Never"),
    ];
}
