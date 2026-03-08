namespace FitMate.Core.Common;

public class CommonJsonModel<T>
{
    public CommonJsonModel(T data)
        : this(data, true, null, null)
    {
    }

    public CommonJsonModel(T data, string? warning)
        : this(data, true, null, warning)
    {
    }

    public CommonJsonModel(string error)
        : this(default!, false, error, null)
    {
    }

    public CommonJsonModel(string error, T data)
        : this(data, false, error, null)
    {
    }

    private CommonJsonModel(T data, bool success, string? error, string? warning)
    {
        Success = success;
        Data = data;
        Error = error;
        Warning = warning;
    }

    public bool Success { get; set; }
    public T Data { get; set; }
    public string? Error { get; set; }
    public string? Warning { get; set; }
}
