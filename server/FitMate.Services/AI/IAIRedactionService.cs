namespace FitMate.Services.AI;

/// <summary>
/// Strips credentials before anything is persisted. The database should never hold a usable secret,
/// even if one leaks into a prompt, a tool argument or a provider error message.
/// </summary>
public interface IAIRedactionService
{
    string RedactText(string input);

    string RedactJson(string input);
}
