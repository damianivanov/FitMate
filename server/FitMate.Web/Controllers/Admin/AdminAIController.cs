using FitMate.Core.JsonModels.AdminAI;
using FitMate.DB;
using FitMate.Services.AdminAI;
using FitMate.Services.AI;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/ai")]
public class AdminAIController : BaseApiController
{
    private readonly IAdminAIService adminAIService;
    private readonly IAdminUnsupportedRequestService unsupportedRequestService;
    private readonly IAISettingsService settingsService;

    public AdminAIController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminAIService adminAIService,
        IAdminUnsupportedRequestService unsupportedRequestService,
        IAISettingsService settingsService)
        : base(logger, dbContext, userService)
    {
        this.adminAIService = adminAIService;
        this.unsupportedRequestService = unsupportedRequestService;
        this.settingsService = settingsService;
    }

    [HttpGet("settings")]
    public async Task<ActionResult> GetSettings()
    {
        var settings = await settingsService.GetAsync();
        return this.ReturnJson(settings);
    }

    [HttpPut("settings")]
    public async Task<ActionResult> SaveSettings([FromBody] SaveAISettingsRequest request)
    {
        var settings = await settingsService.SaveAsync(request);
        return this.ReturnJson(settings);
    }

    [HttpGet("costs/users")]
    public async Task<ActionResult> GetUserCosts([FromQuery] AIUserCostQueryRequest request)
    {
        var costs = await adminAIService.GetUserCostsAsync(request);
        return this.ReturnJson(costs);
    }

    [HttpGet("overview")]
    public async Task<ActionResult> GetOverview([FromQuery] int days = 30)
    {
        var overview = await adminAIService.GetOverviewAsync(days);
        return this.ReturnJson(overview);
    }

    [HttpGet("conversations")]
    public async Task<ActionResult> ListConversations([FromQuery] AIConversationQueryRequest request)
    {
        var response = await adminAIService.ListConversationsAsync(request);
        return this.ReturnJson(response);
    }

    [HttpGet("conversations/{id}")]
    public async Task<ActionResult> GetConversation(long id)
    {
        var conversation = await adminAIService.GetConversationAsync(id);
        return this.ReturnJson(conversation);
    }

    [HttpGet("runs")]
    public async Task<ActionResult> ListRuns([FromQuery] AIRunQueryRequest request)
    {
        var response = await adminAIService.ListRunsAsync(request);
        return this.ReturnJson(response);
    }

    [HttpGet("runs/{id}")]
    public async Task<ActionResult> GetRun(long id)
    {
        var run = await adminAIService.GetRunAsync(id);
        return this.ReturnJson(run);
    }

    [HttpGet("usage")]
    public async Task<ActionResult> GetUsage([FromQuery] DateOnly? periodStart)
    {
        var usage = await adminAIService.GetUsageAsync(periodStart);
        return this.ReturnJson(usage);
    }

    [HttpGet("costs")]
    public async Task<ActionResult> GetCosts([FromQuery] int days = 30)
    {
        var costs = await adminAIService.GetCostsAsync(days);
        return this.ReturnJson(costs);
    }

    [HttpGet("unsupported-requests")]
    public async Task<ActionResult> ListUnsupported([FromQuery] UnsupportedRequestQueryRequest request)
    {
        var response = await unsupportedRequestService.ListAsync(request);
        return this.ReturnJson(response);
    }

    [HttpGet("unsupported-requests/categories")]
    public async Task<ActionResult> ListUnsupportedCategories()
    {
        var categories = await unsupportedRequestService.GetCategoriesAsync();
        return this.ReturnJson(categories);
    }

    [HttpGet("unsupported-requests/{id}")]
    public async Task<ActionResult> GetUnsupported(long id)
    {
        var model = await unsupportedRequestService.GetByIdAsync(id);
        return this.ReturnJson(model);
    }

    [HttpPut("unsupported-requests/{id}")]
    public async Task<ActionResult> UpdateUnsupported(long id, [FromBody] UpdateUnsupportedRequestRequest request)
    {
        var model = await unsupportedRequestService.UpdateAsync(id, request);
        return this.ReturnJson(model);
    }
}
