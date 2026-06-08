using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Users;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Users;

public class AdminUserService : IAdminUserService
{
    private readonly AppDbContext dbContext;
    private readonly UserManager<User> userManager;
    private readonly IUserService userService;

    public AdminUserService(
        AppDbContext dbContext,
        UserManager<User> userManager,
        IUserService userService)
    {
        this.dbContext = dbContext;
        this.userManager = userManager;
        this.userService = userService;
    }

    public async Task<PagedResponse<AdminUserModel>> ListAsync(UserQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                (x.Email != null && x.Email.Contains(search))
                || (x.FirstName != null && x.FirstName.Contains(search))
                || (x.LastName != null && x.LastName.Contains(search)));
        }

        query = query.OrderByDescending(x => x.DateCreated).ThenByDescending(x => x.Id);

        var totalCount = await query.CountAsync();
        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var adminUserIds = await GetAdminUserIdsAsync(users.Select(x => x.Id).ToList());

        return new PagedResponse<AdminUserModel>
        {
            Items = users.Select(x => MapToModel(x, adminUserIds.Contains(x.Id))).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<AdminUserModel> UpdateAsync(long id, UpdateUserRequest request)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user == null)
        {
            throw new FitMateException("User not found.");
        }

        var currentUserId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");
        var isSelf = currentUserId == user.Id;
        var isCurrentlyAdmin = await userManager.IsInRoleAsync(user, RoleNames.Admin);

        if (isSelf && isCurrentlyAdmin && !request.IsAdmin)
        {
            throw new FitMateException("You cannot remove your own admin role.");
        }

        if (isSelf && !request.IsActive)
        {
            throw new FitMateException("You cannot deactivate your own account.");
        }

        if (request.IsAdmin && !isCurrentlyAdmin)
        {
            await userManager.AddToRoleAsync(user, RoleNames.Admin);
        }
        else if (!request.IsAdmin && isCurrentlyAdmin)
        {
            if (await GetAdminCountAsync() <= 1)
            {
                throw new FitMateException("Cannot remove the last admin.");
            }

            await userManager.RemoveFromRoleAsync(user, RoleNames.Admin);
        }

        if (user.IsActive != request.IsActive)
        {
            user.IsActive = request.IsActive;
            await userManager.UpdateAsync(user);
        }

        return MapToModel(user, request.IsAdmin);
    }

    public async Task<bool> DeleteAsync(long id)
    {
        var currentUserId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");
        if (currentUserId == id)
        {
            throw new FitMateException("You cannot delete your own account.");
        }

        var user = await userManager.FindByIdAsync(id.ToString());
        if (user == null)
        {
            throw new FitMateException("User not found.");
        }

        if (await userManager.IsInRoleAsync(user, RoleNames.Admin) && await GetAdminCountAsync() <= 1)
        {
            throw new FitMateException("Cannot delete the last admin.");
        }

        try
        {
            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                throw new FitMateException("Unable to delete user.");
            }
        }
        catch (DbUpdateException)
        {
            throw new FitMateException("User has related data and cannot be deleted.");
        }

        return true;
    }

    private async Task<int> GetAdminCountAsync()
    {
        var adminRoleId = await dbContext.Roles
            .Where(r => r.Name == RoleNames.Admin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        if (adminRoleId == 0)
        {
            return 0;
        }

        return await dbContext.UserRoles.CountAsync(ur => ur.RoleId == adminRoleId);
    }

    private async Task<HashSet<long>> GetAdminUserIdsAsync(IReadOnlyCollection<long> userIds)
    {
        if (userIds.Count == 0)
        {
            return new HashSet<long>();
        }

        var adminRoleId = await dbContext.Roles
            .Where(r => r.Name == RoleNames.Admin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        if (adminRoleId == 0)
        {
            return new HashSet<long>();
        }

        var ids = await dbContext.UserRoles
            .Where(ur => ur.RoleId == adminRoleId && userIds.Contains(ur.UserId))
            .Select(ur => ur.UserId)
            .ToListAsync();

        return ids.ToHashSet();
    }

    private static AdminUserModel MapToModel(User user, bool isAdmin)
    {
        return new AdminUserModel
        {
            Id = user.Id,
            Email = user.Email ?? user.UserName ?? string.Empty,
            FirstName = user.FirstName,
            LastName = user.LastName,
            IsActive = user.IsActive,
            IsAdmin = isAdmin,
            DateCreated = user.DateCreated,
            LastLoginAt = user.LastLoginAt,
        };
    }
}
