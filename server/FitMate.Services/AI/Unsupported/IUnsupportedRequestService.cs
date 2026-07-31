using FitMate.Core.JsonModels.AdminAI;

namespace FitMate.Services.AI.Unsupported;

public interface IUnsupportedRequestService
{
    /// <summary>
    /// Deduplicates on (Category, NormalizedKey): increments the existing group or creates it, and
    /// always appends an occurrence row so admins can inspect real examples.
    /// </summary>
    Task<long> RecordAsync(RecordUnsupportedRequestRequest request, long userId);
}
