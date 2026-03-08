namespace FitMate.Core.Exceptions;

public class FitMateException : Exception
{
    public FitMateException()
    {
    }

    public FitMateException(string message)
        : base(message)
    {
    }

    public FitMateException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
