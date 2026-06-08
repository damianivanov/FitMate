using FitMate.Core.JsonModels.Users;
using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[Route("api/admin/users")]
[Authorize(Policy = "Admin")]
public class AdminUserController : BaseApiController
{
    private readonly IAdminUserService adminUserService;

    public AdminUserController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminUserService adminUserService)
        : base(logger, dbContext, userService)
    {
        this.adminUserService = adminUserService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] UserQueryRequest request)
    {
        var response = await adminUserService.ListAsync(request);
        return this.ReturnJson(response);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdateUserRequest request)
    {
        var updated = await adminUserService.UpdateAsync(id, request);
        return this.ReturnJson(updated);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(long id)
    {
        var isDeleted = await adminUserService.DeleteAsync(id);
        return this.ReturnJson(isDeleted);
    }
}
