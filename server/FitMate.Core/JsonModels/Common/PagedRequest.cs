using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Common;

public class PagedRequest
{
    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 200)]
    public int PageSize { get; set; } = 20;
}
