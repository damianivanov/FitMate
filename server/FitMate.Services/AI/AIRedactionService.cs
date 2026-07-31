using System.Text.RegularExpressions;

namespace FitMate.Services.AI;

public partial class AIRedactionService : IAIRedactionService
{
    private const string Placeholder = "[REDACTED]";

    public string RedactText(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return input;
        }

        var result = JwtPattern().Replace(input, Placeholder);
        result = BearerPattern().Replace(result, $"Bearer {Placeholder}");
        result = StripeKeyPattern().Replace(result, Placeholder);
        result = OpenAIKeyPattern().Replace(result, Placeholder);
        result = ConnectionStringPattern().Replace(result, Placeholder);
        result = SignedBlobQueryPattern().Replace(result, $"sig={Placeholder}");
        result = CookiePattern().Replace(result, $"Cookie: {Placeholder}");
        result = LongHexSecretPattern().Replace(result, Placeholder);

        return result;
    }

    public string RedactJson(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return input;
        }

        // Redact by key first so "password": "hunter2" is caught even when the value looks harmless,
        // then run the value-based patterns over whatever is left.
        var result = SensitiveJsonPropertyPattern().Replace(input, match =>
            $"\"{match.Groups["key"].Value}\":\"{Placeholder}\"");

        return RedactText(result);
    }

    [GeneratedRegex(@"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}", RegexOptions.Compiled)]
    private static partial Regex JwtPattern();

    [GeneratedRegex(@"Bearer\s+[A-Za-z0-9._\-]{10,}", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex BearerPattern();

    [GeneratedRegex(@"\b(sk|pk|rk|whsec)_(live|test)?[_-]?[A-Za-z0-9]{10,}\b", RegexOptions.Compiled)]
    private static partial Regex StripeKeyPattern();

    [GeneratedRegex(@"\bsk-[A-Za-z0-9_\-]{16,}\b", RegexOptions.Compiled)]
    private static partial Regex OpenAIKeyPattern();

    [GeneratedRegex(
        @"(Server|Host|Data Source|AccountKey|Password|Pwd)\s*=\s*[^;""']+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex ConnectionStringPattern();

    [GeneratedRegex(@"sig=[A-Za-z0-9%+/=_\-]{10,}", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex SignedBlobQueryPattern();

    [GeneratedRegex(@"Cookie:\s*[^\r\n]+", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex CookiePattern();

    [GeneratedRegex(@"\b[A-Fa-f0-9]{40,}\b", RegexOptions.Compiled)]
    private static partial Regex LongHexSecretPattern();

    [GeneratedRegex(
        "\"(?<key>password|passwd|pwd|secret|token|apikey|api_key|accesstoken|access_token|refreshtoken|refresh_token|authorization|connectionstring|connection_string|clientsecret|client_secret)\"\\s*:\\s*\"[^\"]*\"",
        RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex SensitiveJsonPropertyPattern();
}
