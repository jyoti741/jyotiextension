using System.Diagnostics;
using Backend.DTOs;
using Backend.Models;
using Backend.Models.AI;
using Backend.Services.AI;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public class ComparisonService
{
    private const int MaxCharacterCap = 4000;
    private readonly GroqProvider _groqProvider;
    private readonly OpenRouterProvider _openRouterProvider;
    private readonly AISettings _aiSettings;
    private readonly ILogger<ComparisonService> _logger;

    public ComparisonService(
        GroqProvider groqProvider,
        OpenRouterProvider openRouterProvider,
        IOptions<AISettings> aiSettings,
        ILogger<ComparisonService> logger)
    {
        _groqProvider = groqProvider;
        _openRouterProvider = openRouterProvider;
        _aiSettings = aiSettings.Value;
        _logger = logger;
    }

    public async Task<(CompareResponse Response, TelemetryLogEntry Telemetry)> CompareAsync(
        CompareRequest request,
        string requestId,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        // 1. Guardrails & Validation: Min 2, Max 4 pages
        if (request.Pages == null || request.Pages.Count < 2 || request.Pages.Count > 4)
        {
            throw new ArgumentException("Comparison requires between 2 and 4 page snapshots.");
        }

        // 2. Intelligent Truncation: Hard cap of 4,000 characters per page snapshot
        var sanitizedPages = request.Pages.Select(p => new PageSnapshot(
            Id: p.Id,
            Url: p.Url,
            Domain: p.Domain,
            Title: p.Title,
            ImportantText: TruncateIntelligently(p.ImportantText, MaxCharacterCap),
            Description: p.Description,
            StructuredData: p.StructuredData,
            CapturedAt: p.CapturedAt
        )).ToList();

        var sanitizedRequest = request with { Pages = sanitizedPages };

        // 3. Resolve Primary and Fallback Provider
        var (primaryProvider, fallbackProvider) = ResolveProviders();

        CompareResponse response;
        AIComparisonResult? activeTelemetry = null;

        try
        {
            response = await primaryProvider.CompareAsync(sanitizedRequest, cancellationToken);
            activeTelemetry = primaryProvider.LastTelemetry;
        }
        catch (Exception primaryEx)
        {
            _logger.LogWarning("Primary AI provider {Primary} failed: {Message}. Attempting fallback to {Fallback}.",
                primaryProvider.ProviderName, primaryEx.Message, fallbackProvider.ProviderName);

            try
            {
                response = await fallbackProvider.CompareAsync(sanitizedRequest, cancellationToken);
                activeTelemetry = fallbackProvider.LastTelemetry;
            }
            catch (Exception fallbackEx)
            {
                _logger.LogError("Fallback AI provider {Fallback} also failed: {Message}",
                    fallbackProvider.ProviderName, fallbackEx.Message);

                throw new HttpRequestException($"AI providers unavailable. Primary: {primaryEx.Message}; Fallback: {fallbackEx.Message}", fallbackEx);
            }
        }

        stopwatch.Stop();

        // 4. Safe Telemetry Construction (Zero raw text, zero URLs, zero prompt logs)
        var telemetry = new TelemetryLogEntry
        {
            RequestId = requestId,
            InstallIdHash = TelemetryLogEntry.ComputeSha256(request.InstallId),
            NumberOfPages = sanitizedPages.Count,
            DurationMs = stopwatch.ElapsedMilliseconds,
            Provider = activeTelemetry?.ProviderName ?? "Unknown",
            Model = activeTelemetry?.ModelName ?? "Unknown",
            PromptTokens = activeTelemetry?.PromptTokens ?? 0,
            CompletionTokens = activeTelemetry?.CompletionTokens ?? 0,
            StatusCode = 200
        };

        return (response, telemetry);
    }

    public static string TruncateIntelligently(string? text, int maxCharacters)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxCharacters)
        {
            return text ?? string.Empty;
        }

        int targetLimit = maxCharacters - 3; // Reserve 3 chars for "..."
        if (targetLimit <= 0) return text.Substring(0, maxCharacters);

        // Search within the last 300 characters for a sentence boundary
        int searchStart = Math.Max(0, targetLimit - 300);
        int searchLength = targetLimit - searchStart;
        string window = text.Substring(searchStart, searchLength);

        int lastSentenceBreak = window.LastIndexOfAny(new[] { '.', '!', '?' });
        if (lastSentenceBreak != -1)
        {
            return text.Substring(0, searchStart + lastSentenceBreak + 1).TrimEnd() + "...";
        }

        // Search for word boundary
        int lastWordBreak = window.LastIndexOf(' ');
        if (lastWordBreak != -1)
        {
            return text.Substring(0, searchStart + lastWordBreak).TrimEnd() + "...";
        }

        // Hard slice fallback
        return text.Substring(0, targetLimit).TrimEnd() + "...";
    }

    private (IAIProvider Primary, IAIProvider Fallback) ResolveProviders()
    {
        bool isGroqPrimary = string.Equals(_aiSettings.PrimaryProvider, "Groq", StringComparison.OrdinalIgnoreCase);

        IAIProvider primary = isGroqPrimary ? _groqProvider : _openRouterProvider;
        IAIProvider fallback = isGroqPrimary ? _openRouterProvider : _groqProvider;

        return (primary, fallback);
    }
}
