using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Services.Exercises;
using FitMate.Services.Storage.Imaging;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/exercises")]
public class ExerciseController : BaseApiController
{
    private readonly IExerciseService exerciseService;

    public ExerciseController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IExerciseService exerciseService)
        : base(logger, dbContext, userService)
    {
        this.exerciseService = exerciseService;
    }

    [HttpGet("get-all")]
    public async Task<ActionResult> GetAll([FromQuery] ExerciseLookupRequest request)
    {
        var items = await exerciseService.GetAllAsync(request);
        return this.ReturnJson(items);
    }

    [HttpGet("mine")]
    public async Task<ActionResult> GetMine([FromQuery] ExerciseLookupRequest request)
    {
        var items = await exerciseService.GetMineAsync(request);
        return this.ReturnJson(items);
    }

    [HttpPost]
    [RequestSizeLimit(UploadConstraints.MaxBytes)]
    public async Task<ActionResult> Create([FromForm] CreateExerciseRequest request, [FromForm] IFormFile? file)
    {
        var imageError = ValidateImage(file);
        if (imageError != null)
        {
            return this.ReturnJsonError(imageError);
        }

        var created = await exerciseService.CreateAsync(request);

        if (file is { Length: > 0 })
        {
            await using var stream = file.OpenReadStream();
            created = await exerciseService.UploadImageAsync(created.Id, stream, file.FileName);
        }

        return this.ReturnJson(created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(long id, [FromBody] CreateExerciseRequest request)
    {
        var updated = await exerciseService.UpdateAsync(id, request);
        return this.ReturnJson(updated);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(long id)
    {
        var isDeleted = await exerciseService.DeleteAsync(id);
        return this.ReturnJson(isDeleted);
    }

    [HttpPost("{id}/image")]
    [RequestSizeLimit(UploadConstraints.MaxBytes)]
    public async Task<ActionResult> UploadImage(long id, [FromForm] IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return this.ReturnJsonError("No file uploaded.");
        }

        var imageError = ValidateImage(file);
        if (imageError != null)
        {
            return this.ReturnJsonError(imageError);
        }

        await using var stream = file.OpenReadStream();
        var updated = await exerciseService.UploadImageAsync(id, stream, file.FileName);

        return this.ReturnJson(updated);
    }

    private static string? ValidateImage(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return null;
        }

        if (file.Length > UploadConstraints.MaxBytes)
        {
            return "File too large. Maximum size is 8 MB.";
        }

        if (!UploadConstraints.AllowedContentTypes.Contains(file.ContentType))
        {
            return "Unsupported file type. Upload a JPEG, PNG, WebP, or GIF image.";
        }

        return null;
    }
}
