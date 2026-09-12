using System.Net;
using System.Text.Json;
using Backend.DTOs;
using Backend.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Backend.Tests;

public class ErrorHandlingMiddlewareTests
{
    private readonly Mock<ILogger<ErrorHandlingMiddleware>> _loggerMock = new();

    [Fact]
    public async Task InvokeAsync_WhenArgumentExceptionThrown_Returns400WithValidationError()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        RequestDelegate next = _ => throw new ArgumentException("Page count invalid");
        var middleware = new ErrorHandlingMiddleware(next, _loggerMock.Object);

        await middleware.InvokeAsync(context);

        Assert.Equal((int)HttpStatusCode.BadRequest, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var response = await JsonSerializer.DeserializeAsync<ApiErrorResponse>(context.Response.Body);

        Assert.NotNull(response);
        Assert.Equal("VALIDATION_ERROR", response.Code);
        Assert.Equal("Page count invalid", response.Message);
        Assert.Null(response.Details);
    }

    [Fact]
    public async Task InvokeAsync_WhenHttpRequestExceptionThrown_Returns502WithAiProviderError()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        RequestDelegate next = _ => throw new HttpRequestException("Groq downstream 500");
        var middleware = new ErrorHandlingMiddleware(next, _loggerMock.Object);

        await middleware.InvokeAsync(context);

        Assert.Equal((int)HttpStatusCode.BadGateway, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var response = await JsonSerializer.DeserializeAsync<ApiErrorResponse>(context.Response.Body);

        Assert.NotNull(response);
        Assert.Equal("AI_PROVIDER_ERROR", response.Code);
        Assert.Contains("Upstream AI provider communication failed", response.Message);
        Assert.Null(response.Details);
    }

    [Fact]
    public async Task InvokeAsync_WhenUnhandledExceptionThrown_Returns500WithoutStackTraces()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        RequestDelegate next = _ => throw new Exception("Unexpected internal error with sensitive stack trace");
        var middleware = new ErrorHandlingMiddleware(next, _loggerMock.Object);

        await middleware.InvokeAsync(context);

        Assert.Equal((int)HttpStatusCode.InternalServerError, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var response = await JsonSerializer.DeserializeAsync<ApiErrorResponse>(context.Response.Body);

        Assert.NotNull(response);
        Assert.Equal("INTERNAL_ERROR", response.Code);
        Assert.DoesNotContain("sensitive", response.Message);
        Assert.Null(response.Details);
    }
}
