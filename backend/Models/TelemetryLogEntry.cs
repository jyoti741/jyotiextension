using System.Security.Cryptography;
using System.Text;

namespace Backend.Models;

public class TelemetryLogEntry
{
    public string RequestId { get; set; } = string.Empty;
    public string InstallIdHash { get; set; } = string.Empty;
    public int NumberOfPages { get; set; }
    public long DurationMs { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens => PromptTokens + CompletionTokens;
    public int StatusCode { get; set; }

    public static string ComputeSha256(string rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return "anonymous";
        }

        byte[] hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawValue));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
