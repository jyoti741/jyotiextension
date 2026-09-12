using System.Threading.RateLimiting;
using Backend.DTOs;
using Backend.Middleware;
using Backend.Models.AI;
using Backend.Services;
using Backend.Services.AI;
using Microsoft.AspNetCore.RateLimiting;

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);

var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}
else if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://localhost:5100");
}

// 1. Configuration & Dependency Injection
builder.Services.Configure<AISettings>(
    builder.Configuration.GetSection(AISettings.SectionName));

builder.Services.AddHttpClient<GroqProvider>();
builder.Services.AddHttpClient<OpenRouterProvider>();
builder.Services.AddScoped<ComparisonService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2. Strict CORS policy: Chrome extension origins, HTTPS domains & local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("ChromeExtensionOnly", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            origin.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase) ||
            origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
            origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase) ||
            origin.StartsWith("https://localhost", StringComparison.OrdinalIgnoreCase) ||
            origin.Contains("compare-anything", StringComparison.OrdinalIgnoreCase))
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

// 3. Built-in ASP.NET Core Rate Limiter: 25 comparisons / day per InstallId or IP fallback
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";

        var errorResponse = new ApiErrorResponse(
            Code: "RATE_LIMIT_EXCEEDED",
            Message: "Today's free comparison limit has been reached. Please try again later.",
            Details: null
        );

        await context.HttpContext.Response.WriteAsJsonAsync(errorResponse, cancellationToken);
    };

    options.AddPolicy("CompareRateLimitPolicy", context =>
    {
        // 1. Rate limit by resolved InstallId
        if (context.Items.TryGetValue(InstallIdResolutionMiddleware.InstallIdItemKey, out var idObj) &&
            idObj is string installId && !string.IsNullOrWhiteSpace(installId))
        {
            return RateLimitPartition.GetFixedWindowLimiter(
                $"install_{installId}",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 25,
                    Window = TimeSpan.FromDays(1),
                    QueueLimit = 0
                });
        }

        // 2. Fallback to client IP
        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "anonymous_ip";
        return RateLimitPartition.GetFixedWindowLimiter(
            $"ip_{clientIp}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 25,
                Window = TimeSpan.FromDays(1),
                QueueLimit = 0
            });
    });
});

var app = builder.Build();

// 4. Middleware Pipeline
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors("ChromeExtensionOnly");

app.UseMiddleware<InstallIdResolutionMiddleware>();
app.UseMiddleware<PrivacyLoggingMiddleware>();

app.UseRateLimiter();

app.MapControllers();

app.MapGet("/", () => Results.Ok(new { status = "running", service = "Compare Anything API" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "Compare Anything API" }));

app.Run();

static void LoadDotEnv()
{
    var current = Directory.GetCurrentDirectory();
    for (int i = 0; i < 3; i++)
    {
        var envPath = Path.Combine(current, ".env");
        if (File.Exists(envPath))
        {
            foreach (var line in File.ReadAllLines(envPath))
            {
                var trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith('#')) continue;
                var parts = trimmed.Split('=', 2);
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var val = parts[1].Trim().Trim('"', '\'');
                    if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                    {
                        Environment.SetEnvironmentVariable(key, val);
                    }
                }
            }
            break;
        }
        var parent = Directory.GetParent(current)?.FullName;
        if (parent == null || parent == current) break;
        current = parent;
    }
}

public partial class Program { }

