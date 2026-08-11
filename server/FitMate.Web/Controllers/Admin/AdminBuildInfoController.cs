using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using FitMate.Web.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/build-info")]
public class AdminBuildInfoController : BaseApiController
{
    public AdminBuildInfoController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService)
        : base(logger, dbContext, userService)
    {
    }

    [HttpGet]
    public ActionResult Get()
    {
        return this.ReturnJson(BuildInfo.Current);
    }
}
