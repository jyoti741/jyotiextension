namespace Backend.Models.AI;

public class AISettings
{
    public const string SectionName = "AISettings";

    public string PrimaryProvider { get; set; } = "Groq";
    public string FallbackProvider { get; set; } = "OpenRouter";

    public ProviderOptions Groq { get; set; } = new()
    {
        Model = "openai/gpt-oss-20b",
        Endpoint = "https://api.groq.com/openai/v1/chat/completions",
        Temperature = 0.2,
        MaxTokens = 4096,
        TimeoutSeconds = 30
    };

    public ProviderOptions OpenRouter { get; set; } = new()
    {
        Model = "meta-llama/llama-3.3-70b-instruct",
        Endpoint = "https://openrouter.ai/api/v1/chat/completions",
        Temperature = 0.2,
        MaxTokens = 4096,
        TimeoutSeconds = 30
    };
}

public class ProviderOptions
{
    public string Model { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public double Temperature { get; set; } = 0.2;
    public int MaxTokens { get; set; } = 4096;
    public int TimeoutSeconds { get; set; } = 30;
}
