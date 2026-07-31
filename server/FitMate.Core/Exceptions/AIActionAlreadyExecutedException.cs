namespace FitMate.Core.Exceptions;

/// <summary>A second confirmation arrived while or after the first one executed.</summary>
public class AIActionAlreadyExecutedException : FitMateException
{
    public AIActionAlreadyExecutedException()
        : base("This suggestion has already been applied.")
    {
    }
}
