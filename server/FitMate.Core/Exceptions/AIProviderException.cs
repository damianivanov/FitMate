namespace FitMate.Core.Exceptions;

public class AIProviderException : FitMateException
{
    public AIProviderException(string message)
        : base(message)
    {
    }

    public AIProviderException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
