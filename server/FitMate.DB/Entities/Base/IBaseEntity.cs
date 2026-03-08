namespace FitMate.DB.Entities.Base;

public interface IBaseEntity
{
    long Id { get; set; }
    DateTime DateCreated { get; set; }
    DateTime? DateModified { get; set; }
}
