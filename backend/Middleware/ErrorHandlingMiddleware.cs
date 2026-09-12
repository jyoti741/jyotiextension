using System.Net;
using System.Text.Json;
using Backend.DTOs;

namespace Backend.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception intercepted during request execution: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, errorCode, userMessage) = exception switch
        {
            ArgumentException argEx => (
                HttpStatusCode.BadRequest,
                "VALIDATION_ERROR",
                argEx.Message
            ),
            HttpRequestException httpEx => (
                HttpStatusCode.BadGateway,
                "AI_PROVIDER_ERROR",
                "Upstream AI provider communication failed. Please try again shortly."
            ),
            TimeoutException => (
                HttpStatusCode.GatewayTimeout,
                "AI_PROVIDER_TIMEOUT",
                "AI inference timed out. Please try comparing fewer or shorter pages."
            ),
            InvalidOperationException opEx when opEx.Message.Contains("API_KEY") => (
                HttpStatusCode.ServiceUnavailable,
                "CONFIGURATION_ERROR",
                "AI service is not properly configured. Please contact support."
            ),
            InvalidOperationException opEx => (
                HttpStatusCode.BadGateway,
                "AI_PROVIDER_FAILED",
                opEx.Message
            ),
            _ => (
                HttpStatusCode.InternalServerError,
                "INTERNAL_ERROR",
                "An unexpected server error occurred. Please try again later."
            )
        };

        context.Response.StatusCode = (int)statusCode;

        var errorResponse = new ApiErrorResponse(
            Code: errorCode,
            Message: userMessage,
            Details: null // Never leak stack traces to client
        );

        await context.Response.WriteAsJsonAsync(errorResponse);
    }
}
