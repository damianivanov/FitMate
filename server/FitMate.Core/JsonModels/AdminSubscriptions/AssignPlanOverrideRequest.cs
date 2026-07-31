using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

/// <summary>
/// Grants a user a plan without billing them — support cases, trials, staff accounts. A reason is
/// mandatory: overrides outrank paid subscriptions, so every one of them has to be explainable.
/// </summary>
public class AssignPlanOverrideRequest
{
    [Required]
    [StringLength(50)]
    public string PlanCode { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;

    public DateTime? EndsAt { get; set; }
}
