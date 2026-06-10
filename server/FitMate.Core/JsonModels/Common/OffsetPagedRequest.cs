using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Common;

public class OffsetPagedRequest
{
    [Range(0, int.MaxValue)]
    public int Skip { get; set; } = 0;

    [Range(1, 100)]
    public int Take { get; set; } = 30;
}
