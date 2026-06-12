using System.Net;

namespace FitMate.Services.Email;

public static class PasswordResetEmail
{
    public const string Subject = "Reset your FitMate password";

    public static string BuildHtml(string resetLink, string? firstName)
    {
        var safeLink = WebUtility.HtmlEncode(resetLink);
        var greeting = string.IsNullOrWhiteSpace(firstName)
            ? "Hi there,"
            : $"Hi {WebUtility.HtmlEncode(firstName)},";

        return $@"<!DOCTYPE html>
<html>
  <body style=""margin:0;padding:0;background-color:#f4f4f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a;"">
    <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""padding:32px 0;"">
      <tr>
        <td align=""center"">
          <table role=""presentation"" width=""460"" cellpadding=""0"" cellspacing=""0"" style=""background:#ffffff;border-radius:16px;padding:32px;"">
            <tr><td>
              <h1 style=""margin:0 0 16px;font-size:22px;"">Reset your password</h1>
              <p style=""margin:0 0 16px;font-size:15px;line-height:1.5;"">{greeting}</p>
              <p style=""margin:0 0 24px;font-size:15px;line-height:1.5;"">
                We received a request to reset your FitMate password. Click the button below to choose a new one.
                This link will expire shortly. If you didn't request this, you can safely ignore this email.
              </p>
              <p style=""margin:0 0 24px;text-align:center;"">
                <a href=""{safeLink}"" style=""display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:600;font-size:15px;"">
                  Reset password
                </a>
              </p>
              <p style=""margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;"">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style=""margin:0;font-size:13px;color:#4f46e5;word-break:break-all;"">{safeLink}</p>
            </td></tr>
          </table>
          <p style=""margin:16px 0 0;font-size:12px;color:#9ca3af;"">FitMate</p>
        </td>
      </tr>
    </table>
  </body>
</html>";
    }
}
