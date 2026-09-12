using System.Text;
using System.Text.Json;

namespace Backend.Middleware;

public class InstallIdResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public const string InstallIdItemKey = "InstallId";

    public InstallIdResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        string? installId = null;

        // 1. Check header
        if (context.Request.Headers.TryGetValue("X-Install-Id", out var headerVal) && !string.IsNullOrWhiteSpace(headerVal))
        {
            installId = headerVal.ToString().Trim();
        }

        // 2. Check query string
        if (string.IsNullOrEmpty(installId) && context.Request.Query.TryGetValue("installId", out var queryVal) && !string.IsNullOrWhiteSpace(queryVal))
        {
            installId = queryVal.ToString().Trim();
        }

        // 3. Check JSON body if POST /api
        if (string.IsNullOrEmpty(installId) &&
            HttpMethods.IsPost(context.Request.Method) &&
            context.Request.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true)
        {
            context.Request.EnableBuffering();

            try
            {
                using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
                var bodyText = await reader.ReadToEndAsync();
                context.Request.Body.Position = 0;

                if (!string.IsNullOrWhiteSpace(bodyText))
                {
                    using var doc = JsonDocument.Parse(bodyText);
                    if (doc.RootElement.TryGetProperty("installId", out var idProp) && idProp.ValueKind == JsonValueKind.String)
                    {
                        installId = idProp.GetString();
                    }
                }
            }
            catch
            {
                context.Request.Body.Position = 0;
            }
        }

        if (!string.IsNullOrWhiteSpace(installId))
        {
            context.Items[InstallIdItemKey] = installId.Trim();
        }

        await _next(context);
    }
}
