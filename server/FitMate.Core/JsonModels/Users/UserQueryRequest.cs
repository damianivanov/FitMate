using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.Users;

public class UserQueryRequest : GridQueryRequest
{
    [StringLength(200)]
    public string? Search { get; set; }
}
