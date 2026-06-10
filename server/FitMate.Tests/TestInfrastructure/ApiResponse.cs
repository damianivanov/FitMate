namespace FitMate.Tests.TestInfrastructure;

public sealed class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public string? Warning { get; set; }
}
