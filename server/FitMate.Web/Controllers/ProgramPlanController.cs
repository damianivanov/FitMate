using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/program-plans")]
public class ProgramPlanController : BaseApiController
{
    private readonly IProgramPlanService programPlanService;

    public ProgramPlanController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IProgramPlanService programPlanService)
        : base(logger, dbContext, userService)
    {
        this.programPlanService = programPlanService;
    }

    [HttpGet]
    public async Task<ActionResult> List()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var items = await programPlanService.ListAsync(userId.Value);
        return this.ReturnJson(items);
    }

    [HttpGet("active")]
    public async Task<ActionResult> GetActive()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await programPlanService.GetActiveAsync(userId.Value);
        return model == null
            ? this.ReturnJsonError("No active program plan.")
            : this.ReturnJson(model);
    }

    [HttpGet("active/today")]
    public async Task<ActionResult> GetToday([FromQuery] DateOnly? date)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        // The client sends its local calendar date; UTC is only a fallback (roadmap D2).
        var referenceDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var model = await programPlanService.GetTodayAsync(userId.Value, referenceDate);
        return this.ReturnJson(model);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult> GetById(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await programPlanService.GetByIdAsync(id, userId.Value);
        return model == null
            ? this.ReturnJsonError("Program plan not found.")
            : this.ReturnJson(model);
    }

    [HttpGet("{id:long}/calendar")]
    public async Task<ActionResult> GetCalendar(long id, [FromQuery] int year, [FromQuery] int month)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        if (year < 1 || year > 9999 || month < 1 || month > 12)
        {
            return this.ReturnJsonError("Invalid year or month.");
        }

        var days = await programPlanService.GetCalendarAsync(id, userId.Value, year, month);
        return this.ReturnJson(days);
    }

    [HttpGet("{id:long}/progress")]
    public async Task<ActionResult> GetProgress(long id, [FromQuery] DateOnly? date)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var referenceDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var progress = await programPlanService.GetProgressAsync(id, userId.Value, referenceDate);
        return this.ReturnJson(progress);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SaveProgramPlanRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var created = await programPlanService.CreateDraftAsync(request, userId.Value);
        return this.ReturnJson(created);
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] SaveProgramPlanRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var updated = await programPlanService.UpdateDraftAsync(id, request, userId.Value);
        return this.ReturnJson(updated);
    }

    [HttpPost("{id:long}/activate")]
    public async Task<ActionResult> Activate(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var activated = await programPlanService.ActivateAsync(id, userId.Value);
        return this.ReturnJson(activated);
    }

    [HttpPost("{id:long}/pause")]
    public async Task<ActionResult> Pause(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        await programPlanService.PauseAsync(id, userId.Value);
        return this.ReturnJson(true);
    }

    [HttpPost("{id:long}/complete")]
    public async Task<ActionResult> Complete(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        await programPlanService.CompleteAsync(id, userId.Value);
        return this.ReturnJson(true);
    }

    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult> Cancel(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        await programPlanService.CancelAsync(id, userId.Value);
        return this.ReturnJson(true);
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var deleted = await programPlanService.DeleteDraftAsync(id, userId.Value);
        return deleted
            ? this.ReturnJson(true)
            : this.ReturnJsonError("Only draft plans can be deleted.");
    }
}
