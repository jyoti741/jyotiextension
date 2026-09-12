using System.Diagnostics;
using Backend.Models;

namespace Backend.Middleware;

public class PrivacyLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PrivacyLoggingMiddleware> _logger;

    public const string TelemetryItemKey = "CompareAnything_Telemetry";

    public PrivacyLoggingMiddleware(RequestDelegate next, ILogger<PrivacyLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await _next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var requestId = context.TraceIdentifier;

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();

            if (context.Items.TryGetValue(TelemetryItemKey, out var item) && item is TelemetryLogEntry telemetry)
            {
                telemetry.StatusCode = context.Response.StatusCode;
                if (telemetry.DurationMs == 0)
                {
                    telemetry.DurationMs = stopwatch.ElapsedMilliseconds;
                }

                _logger.LogInformation(
                    "RequestId: {RequestId} | InstallIdHash: {InstallIdHash} | PageCount: {PageCount} | DurationMs: {DurationMs} | Provider: {Provider} | Model: {Model} | TokenCount: {TokenCount} | HttpStatus: {HttpStatus}",
                    telemetry.RequestId,
                    telemetry.InstallIdHash,
                    telemetry.NumberOfPages,
                    telemetry.DurationMs,
                    telemetry.Provider,
                    telemetry.Model,
                    telemetry.TotalTokens,
                    telemetry.StatusCode);
            }
            else
            {
                string? installId = null;
                if (context.Items.TryGetValue(InstallIdResolutionMiddleware.InstallIdItemKey, out var idObj) && idObj is string strId)
                {
                    installId = strId;
                }
                else
                {
                    installId = context.Request.Headers["X-Install-Id"].FirstOrDefault();
                }

                string installIdHash = TelemetryLogEntry.ComputeSha256(installId ?? "unknown");

                _logger.LogInformation(
                    "RequestId: {RequestId} | InstallIdHash: {InstallIdHash} | PageCount: {PageCount} | DurationMs: {DurationMs} | Provider: {Provider} | Model: {Model} | TokenCount: {TokenCount} | HttpStatus: {HttpStatus}",
                    requestId,
                    installIdHash,
                    0,
                    stopwatch.ElapsedMilliseconds,
                    "None",
                    "None",
                    0,
                    context.Response.StatusCode);
            }
        }
    }
}
