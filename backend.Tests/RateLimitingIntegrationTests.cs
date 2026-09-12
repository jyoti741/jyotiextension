using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Backend.Tests;

public class RateLimitingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public RateLimitingIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CompareEndpoint_WhenExceedingRateLimit_Returns429WithExactContractMessage()
    {
        var client = _factory.CreateClient();
        string testInstallId = "rate_limit_day2_" + Guid.NewGuid();

        var payload = new CompareRequest(
            InstallId: testInstallId,
            Goal: "Performance",
            Pages: new List<PageSnapshot>
            {
                new("1", "https://example.com/1", "example.com", "P1", "Content 1"),
                new("2", "https://example.com/2", "example.com", "P2", "Content 2")
            }
        );

        client.DefaultRequestHeaders.Add("X-Install-Id", testInstallId);

        HttpResponseMessage? lastResponse = null;

        // Exhaust the 25-permit limit
        for (int i = 0; i < 26; i++)
        {
            lastResponse = await client.PostAsJsonAsync("/api/v1/compare", payload);
            if (lastResponse.StatusCode == HttpStatusCode.TooManyRequests)
            {
                break;
            }
        }

        Assert.NotNull(lastResponse);
        Assert.Equal(HttpStatusCode.TooManyRequests, lastResponse.StatusCode);

        var body = await lastResponse.Content.ReadAsStringAsync();
        using var jsonDoc = JsonDocument.Parse(body);

        Assert.True(jsonDoc.RootElement.TryGetProperty("code", out var codeProp));
        Assert.Equal("RATE_LIMIT_EXCEEDED", codeProp.GetString());

        Assert.True(jsonDoc.RootElement.TryGetProperty("message", out var msgProp));
        Assert.Equal("Today's free comparison limit has been reached. Please try again later.", msgProp.GetString());
    }
}
