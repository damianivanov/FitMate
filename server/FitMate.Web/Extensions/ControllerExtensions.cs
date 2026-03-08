using FitMate.Core.Common;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Extensions;

public static class ControllerExtensions
{
    public static JsonResult ReturnJson<T>(this ControllerBase controller, T data, string? warning = null)
    {
        var model = new CommonJsonModel<T>(data, warning);
        return new JsonResult(model);
    }

    public static JsonResult ReturnJsonError(this ControllerBase controller, string error)
    {
        var model = new CommonJsonModel<string?>(error);
        return new JsonResult(model);
    }

    public static JsonResult ReturnJsonError<T>(this ControllerBase controller, string error, T data)
    {
        var model = new CommonJsonModel<T>(error, data);
        return new JsonResult(model);
    }
}
