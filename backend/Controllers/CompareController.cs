using Backend.DTOs;
using Backend.Middleware;
using Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class CompareController : ControllerBase
{
    private readonly ComparisonService _comparisonService;
    private readonly ILogger<CompareController> _logger;

    public CompareController(ComparisonService comparisonService, ILogger<CompareController> logger)
    {
        _comparisonService = comparisonService;
        _logger = logger;
    }

    [HttpPost]
    [EnableRateLimiting("CompareRateLimitPolicy")]
    [ProducesResponseType(typeof(CompareResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status502BadGateway)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> CompareAsync([FromBody] CompareRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(new ApiErrorResponse(
                Code: "VALIDATION_ERROR",
                Message: "The comparison request payload failed validation.",
                Details: errors
            ));
        }

        if (request.Pages == null || request.Pages.Count < 2 || request.Pages.Count > 4)
        {
            return BadRequest(new ApiErrorResponse(
                Code: "INVALID_PAGE_COUNT",
                Message: "Comparison requires between 2 and 4 page snapshots.",
                Details: null
            ));
        }

        string requestId = HttpContext.TraceIdentifier;

        try
        {
            var (response, telemetry) = await _comparisonService.CompareAsync(request, requestId, cancellationToken);

            // Forward telemetry to PrivacyLoggingMiddleware
            HttpContext.Items[PrivacyLoggingMiddleware.TelemetryItemKey] = telemetry;

            return Ok(response);
        }
        catch (ArgumentException argEx)
        {
            return BadRequest(new ApiErrorResponse(
                Code: "VALIDATION_ERROR",
                Message: argEx.Message
            ));
        }
        catch (HttpRequestException httpEx)
        {
            _logger.LogError(httpEx, "Upstream AI provider error: {Message}", httpEx.Message);
            return StatusCode(StatusCodes.Status502BadGateway, new ApiErrorResponse(
                Code: "AI_PROVIDER_ERROR",
                Message: "Downstream AI provider is temporarily unavailable. Please try again shortly."
            ));
        }
        catch (InvalidOperationException opEx) when (opEx.Message.Contains("API_KEY", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError(opEx, "Configuration error: {Message}", opEx.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ApiErrorResponse(
                Code: "SERVICE_CONFIG_ERROR",
                Message: "The comparison service configuration is incomplete."
            ));
        }
    }
}
