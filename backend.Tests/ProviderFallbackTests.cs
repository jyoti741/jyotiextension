using System.Net;
using System.Text.Json;
using Backend.DTOs;
using Backend.Models.AI;
using Backend.Services;
using Backend.Services.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xunit;

namespace Backend.Tests;

public class ProviderFallbackTests
{
    private readonly IOptions<AISettings> _settings = Options.Create(new AISettings
    {
        PrimaryProvider = "Groq",
        FallbackProvider = "OpenRouter",
        Groq = new ProviderOptions { Model = "groq-model-test", Endpoint = "https://api.groq.com/test" },
        OpenRouter = new ProviderOptions { Model = "openrouter-model-test", Endpoint = "https://openrouter.ai/test" }
    });

    private readonly IConfiguration _config = new ConfigurationBuilder().Build();

    [Fact]
    public async Task CompareAsync_WhenPrimaryProviderFails_InvokesFallbackProvider()
    {
        Environment.SetEnvironmentVariable("GROQ_API_KEY", "dummy_groq_key");
        Environment.SetEnvironmentVariable("OPENROUTER_API_KEY", "dummy_openrouter_key");

        // 1. Mock Groq HttpClient to return 500 Internal Server Error
        var groqHttpMock = new Mock<HttpMessageHandler>();
        groqHttpMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.InternalServerError,
                Content = new StringContent("{\"error\":\"Groq overloaded\"}")
            });

        // 2. Mock OpenRouter HttpClient to return valid Day 2 CompareResponse JSON
        var expectedAiResponse = new CompareResponse(
            ComparisonTitle: "Laptop Comparison",
            ComparisonType: "Product Comparison",
            Goal: "Battery life",
            Items: new List<ItemSummary>
            {
                new("1", "Laptop A", "High endurance laptop"),
                new("2", "Laptop B", "Budget laptop")
            },
            Criteria: new List<CriterionEvaluation>
            {
                new("Battery Life", "High", new List<CriterionValue>
                {
                    new("1", "12 hours", "High"),
                    new("2", "6 hours", "Medium")
                }, new List<string> { "1" })
            },
            BestOverall: new BestOverall("1", "Significantly longer battery runtime."),
            BestFor: new List<BestForRecommendation>
            {
                new("Best Battery", "1", "12 hours runtime")
            },
            KeyDifferences: new List<string> { "Laptop A has double the battery capacity." },
            MissingInformation: new List<MissingInformation>
            {
                new("2", new List<string> { "Weight", "Warranty" })
            },
            Sources: new List<SourceAttribution>
            {
                new("1", "https://example.com/a", "example.com"),
                new("2", "https://example.com/b", "example.com")
            }
        );

        var openRouterResponseJson = JsonSerializer.Serialize(new ChatCompletionResponse
        {
            Model = "openrouter-model-test",
            Choices = new List<ChatChoice>
            {
                new()
                {
                    Message = new ChatMessage
                    {
                        Role = "assistant",
                        Content = JsonSerializer.Serialize(expectedAiResponse)
                    }
                }
            },
            Usage = new ChatUsage { PromptTokens = 500, CompletionTokens = 200, TotalTokens = 700 }
        });

        var openRouterHttpMock = new Mock<HttpMessageHandler>();
        openRouterHttpMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(openRouterResponseJson)
            });

        var groqClient = new HttpClient(groqHttpMock.Object);
        var openRouterClient = new HttpClient(openRouterHttpMock.Object);

        var groqLogger = new Mock<ILogger<GroqProvider>>();
        var openRouterLogger = new Mock<ILogger<OpenRouterProvider>>();
        var serviceLogger = new Mock<ILogger<ComparisonService>>();

        var groqProvider = new GroqProvider(groqClient, _settings, _config, groqLogger.Object);
        var openRouterProvider = new OpenRouterProvider(openRouterClient, _settings, _config, openRouterLogger.Object);

        var service = new ComparisonService(groqProvider, openRouterProvider, _settings, serviceLogger.Object);

        var request = new CompareRequest(
            InstallId: "test_install_id",
            Goal: "Battery life",
            Pages: new List<PageSnapshot>
            {
                new("1", "https://example.com/a", "example.com", "Laptop A", "12 hours battery life."),
                new("2", "https://example.com/b", "example.com", "Laptop B", "6 hours battery life.")
            }
        );

        // Act
        var (response, telemetry) = await service.CompareAsync(request, "req_12345");

        // Assert
        Assert.NotNull(response);
        Assert.Equal("Laptop Comparison", response.ComparisonTitle);
        Assert.Equal("OpenRouter", telemetry.Provider);
        Assert.Equal("openrouter-model-test", telemetry.Model);
        Assert.Equal(500, telemetry.PromptTokens);
        Assert.Equal(200, telemetry.CompletionTokens);
    }
}
