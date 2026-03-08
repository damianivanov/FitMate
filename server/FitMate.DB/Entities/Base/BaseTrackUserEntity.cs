using FitMate.DB.Entities;

namespace FitMate.DB.Entities.Base;

public class BaseTrackUserEntity : BaseEntity, IBaseTrackUserEntity
{
    public long? CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public long? ModifiedById { get; set; }
    public User? ModifiedBy { get; set; }
}
