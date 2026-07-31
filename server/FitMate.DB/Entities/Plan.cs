using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class Plan : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }

    public ICollection<PlanPrice> Prices { get; set; } = [];
    public ICollection<PlanEntitlement> Entitlements { get; set; } = [];
}
