using FitMate.Services.AI;

namespace FitMate.Tests.Unit.Services;

public class AIRedactionServiceTests
{
    private static readonly AIRedactionService Service = new();

    // JWT токен не оцелява в записания текст
    [Fact]
    public void RedactText_Jwt_IsRemoved()
    {
        const string secret = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

        var result = Service.RedactText($"my token is {secret}");

        Assert.DoesNotContain(secret, result);
        Assert.Contains("[REDACTED]", result);
    }

    // Authorization header със Bearer се маскира
    [Fact]
    public void RedactText_BearerHeader_IsRemoved()
    {
        var result = Service.RedactText("Authorization: Bearer abcdef1234567890abcdef");

        Assert.DoesNotContain("abcdef1234567890abcdef", result);
    }

    // Stripe ключове се маскират
    [Theory]
    [InlineData("sk_live_51H8xYzABCdefGHIjklMNO")]
    [InlineData("whsec_1234567890abcdefghijklmn")]
    public void RedactText_StripeKeys_AreRemoved(string secret)
    {
        var result = Service.RedactText($"key {secret} end");

        Assert.DoesNotContain(secret, result);
    }

    // OpenAI ключ се маскира
    [Fact]
    public void RedactText_OpenAiKey_IsRemoved()
    {
        const string secret = "sk-proj-0123456789abcdefghijklmnop";

        var result = Service.RedactText($"OPENAI_API_KEY={secret}");

        Assert.DoesNotContain(secret, result);
    }

    // Connection string се маскира
    [Fact]
    public void RedactText_ConnectionString_IsRemoved()
    {
        var result = Service.RedactText("Server=db.example.com;Password=SuperSecret123;");

        Assert.DoesNotContain("SuperSecret123", result);
        Assert.DoesNotContain("db.example.com", result);
    }

    // Подписан blob URL губи подписа си
    [Fact]
    public void RedactText_SignedBlobUrl_LosesSignature()
    {
        var result = Service.RedactText("https://acc.blob.core.windows.net/x/y?sv=2021&sig=aBc123%2FdEf456ghi789");

        Assert.DoesNotContain("aBc123%2FdEf456ghi789", result);
    }

    // Cookie заглавие се маскира
    [Fact]
    public void RedactText_Cookie_IsRemoved()
    {
        var result = Service.RedactText("Cookie: Token=abc123; Refresh=def456");

        Assert.DoesNotContain("abc123", result);
    }

    // JSON полета с чувствителни имена се маскират по ключ
    [Theory]
    [InlineData("password")]
    [InlineData("apiKey")]
    [InlineData("refresh_token")]
    [InlineData("clientSecret")]
    public void RedactJson_SensitiveProperties_AreRemoved(string key)
    {
        var result = Service.RedactJson($$"""{"{{key}}":"hunter2","name":"Bench press"}""");

        Assert.DoesNotContain("hunter2", result);
        Assert.Contains("Bench press", result);
    }

    // Безобидният JSON остава непокътнат
    [Fact]
    public void RedactJson_HarmlessPayload_IsUnchanged()
    {
        const string payload = """{"exerciseId":12,"reps":8,"weightKg":60}""";

        Assert.Equal(payload, Service.RedactJson(payload));
    }

    // Празният вход не чупи услугата
    [Fact]
    public void Redact_EmptyInput_IsReturnedAsIs()
    {
        Assert.Equal(string.Empty, Service.RedactText(string.Empty));
        Assert.Equal(string.Empty, Service.RedactJson(string.Empty));
    }
}
