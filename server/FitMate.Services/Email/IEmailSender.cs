namespace FitMate.Services.Email;

public interface IEmailSender
{
    /// <summary>
    /// Sends an HTML email. Returns <c>true</c> on success, <c>false</c> if sending failed
    /// (failures are logged internally and never surfaced to callers as exceptions).
    /// </summary>
    Task<bool> SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
}
