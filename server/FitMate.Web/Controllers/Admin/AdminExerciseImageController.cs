using FitMate.Core.Common;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Services.Exercises;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

/// <summary>
/// Slug-addressed image upload, used to import a whole folder of exercise images at once. It is the
/// same two-step direct-to-storage flow as <see cref="ExerciseController"/> — the browser PUTs the
/// bytes straight to blob storage, and only the small control-plane calls come here — but keyed off
/// the exercise slug so the client never has to resolve ids itself. Matching a folder against the
/// entire catalogue is reserved for the super administrator.
/// </summary>
[SuperAdminGuard]
[Route("api/admin/exercises/images")]
public class AdminExerciseImageController : BaseApiController
{
    private readonly IExerciseService exerciseService;

    public AdminExerciseImageController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IExerciseService exerciseService)
        : base(logger, dbContext, userService)
    {
        this.exerciseService = exerciseService;
    }

    [HttpPost("upload-url")]
    public async Task<ActionResult> CreateUploadUrl([FromBody] BulkExerciseImageTicketRequest request)
    {
        var ticket = await exerciseService.CreateBulkImageUploadTicketAsync(request);
        return ticket == null ? SlugNotFound(request.Slug) : this.ReturnJson(ticket);
    }

    [HttpPost("confirm")]
    public async Task<ActionResult> Confirm([FromBody] ConfirmBulkExerciseImageRequest request)
    {
        var updated = await exerciseService.ConfirmBulkImageUploadAsync(request);
        return updated == null ? SlugNotFound(request.Slug) : this.ReturnJson(updated);
    }

    /// <summary>
    /// A file named after nothing in the catalogue is a routine outcome of pointing the importer at
    /// a folder, so it answers 404 — telling "this one matched nothing" apart from "this one broke"
    /// without the client having to read error text.
    /// </summary>
    private static JsonResult SlugNotFound(string slug) =>
        new(new CommonJsonModel<object?>($"No exercise matches the slug '{slug}'."))
        {
            StatusCode = StatusCodes.Status404NotFound,
        };
}
