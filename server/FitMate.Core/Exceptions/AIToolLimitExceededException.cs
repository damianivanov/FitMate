namespace FitMate.Core.Exceptions;

public class AIToolLimitExceededException : FitMateException
{
    public AIToolLimitExceededException(string message)
        : base(message)
    {
    }
}
