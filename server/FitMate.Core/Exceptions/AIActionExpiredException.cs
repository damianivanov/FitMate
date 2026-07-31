namespace FitMate.Core.Exceptions;

/// <summary>A pending action outlived its confirmation window and can no longer execute.</summary>
public class AIActionExpiredException : FitMateException
{
    public AIActionExpiredException()
        : base("This suggestion has expired. Ask the assistant to prepare it again.")
    {
    }
}
