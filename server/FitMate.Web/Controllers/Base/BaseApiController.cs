using FitMate.DB;
using FitMate.Services.Users;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Base;

[ApiController]
public class BaseApiController : ControllerBase
{
    protected readonly ILogger<BaseApiController> Logger;
    protected readonly AppDbContext DbContext;
    protected readonly IUserService UserService;

    public BaseApiController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService)
    {
        Logger = logger;
        DbContext = dbContext;
        UserService = userService;
    }
}
