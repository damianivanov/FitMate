using FitMate.DB.Entities;

namespace FitMate.DB.Entities.Base;

public interface IBaseTrackUserEntity : IBaseEntity
{
    long? CreatedById { get; set; }
    User? CreatedBy { get; set; }
    long? ModifiedById { get; set; }
    User? ModifiedBy { get; set; }
}
