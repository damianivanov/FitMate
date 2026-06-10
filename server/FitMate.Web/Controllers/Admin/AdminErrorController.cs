using FitMate.Core.JsonModels.Errors;
using FitMate.DB;
using FitMate.Services.Errors;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/errors")]
public class AdminErrorController : BaseApiController
{
    private readonly IAdminErrorService adminErrorService;

    public AdminErrorController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminErrorService adminErrorService)
        : base(logger, dbContext, userService)
    {
        this.adminErrorService = adminErrorService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] ErrorQueryRequest request)
    {
        var response = await adminErrorService.ListAsync(request);
        return this.ReturnJson(response);
    }

    [HttpDelete("all")]
    public async Task<ActionResult> ClearAll()
    {
        var deletedCount = await adminErrorService.ClearAllAsync();
        return this.ReturnJson(deletedCount);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(long id)
    {
        var isDeleted = await adminErrorService.DeleteAsync(id);
        return this.ReturnJson(isDeleted);
    }
}
