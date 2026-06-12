using FitMate.Core.Settings;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace FitMate.Services.Email;

public class SmtpEmailSender : IEmailSender
{
    private readonly ApplicationSettings settings;
    private readonly ILogger<SmtpEmailSender> logger;

    public SmtpEmailSender(ApplicationSettings settings, ILogger<SmtpEmailSender> logger)
    {
        this.settings = settings;
        this.logger = logger;
    }

    public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(settings.SmtpHost) || string.IsNullOrWhiteSpace(settings.EmailFromAddress))
        {
            logger.LogError("SMTP is not configured (host/from address missing); cannot send email to {Recipient}.", toEmail);
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(settings.EmailFromName, settings.EmailFromAddress));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            // Port 465 = implicit TLS; everything else (587 etc.) = STARTTLS.
            var secureSocketOptions = settings.SmtpPort == 465
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;

            using var client = new SmtpClient();
            await client.ConnectAsync(settings.SmtpHost, settings.SmtpPort, secureSocketOptions, cancellationToken);

            if (!string.IsNullOrWhiteSpace(settings.SmtpUser))
            {
                await client.AuthenticateAsync(settings.SmtpUser, settings.SmtpPassword, cancellationToken);
            }

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send email to {Recipient}.", toEmail);
            return false;
        }
    }
}
