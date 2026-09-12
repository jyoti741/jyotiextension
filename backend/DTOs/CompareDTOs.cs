using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Backend.DTOs;

public record CompareRequest
{
    [Required(ErrorMessage = "InstallId is required and must be a valid identifier.")]
    [JsonPropertyName("installId")]
    public string InstallId { get; init; } = string.Empty;

    [JsonPropertyName("goal")]
    public string? Goal { get; init; }

    [Required(ErrorMessage = "Pages list is required.")]
    [MinLength(2, ErrorMessage = "At least 2 pages are required for comparison.")]
    [MaxLength(4, ErrorMessage = "A maximum of 4 pages can be compared.")]
    [JsonPropertyName("pages")]
    public List<PageSnapshot> Pages { get; init; } = new();

    public CompareRequest() { }

    public CompareRequest(string InstallId, string? Goal, List<PageSnapshot> Pages)
    {
        this.InstallId = InstallId;
        this.Goal = Goal;
        this.Pages = Pages;
    }
}

public record PageSnapshot
{
    [Required]
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("domain")]
    public string? Domain { get; init; }

    [Required]
    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("structuredData")]
    public string? StructuredData { get; init; }

    [Required]
    [JsonPropertyName("importantText")]
    public string ImportantText { get; init; } = string.Empty;

    [JsonPropertyName("capturedAt")]
    public string? CapturedAt { get; init; }

    public PageSnapshot() { }

    public PageSnapshot(
        string Id,
        string? Url,
        string? Domain,
        string Title,
        string ImportantText,
        string? Description = null,
        string? StructuredData = null,
        string? CapturedAt = null)
    {
        this.Id = Id;
        this.Url = Url;
        this.Domain = Domain;
        this.Title = Title;
        this.ImportantText = ImportantText;
        this.Description = Description;
        this.StructuredData = StructuredData;
        this.CapturedAt = CapturedAt;
    }
}

public record CompareResponse(
    [property: JsonPropertyName("comparisonTitle")]
    string ComparisonTitle,

    [property: JsonPropertyName("comparisonType")]
    string ComparisonType,

    [property: JsonPropertyName("goal")]
    string? Goal,

    [property: JsonPropertyName("items")]
    List<ItemSummary> Items,

    [property: JsonPropertyName("criteria")]
    List<CriterionEvaluation> Criteria,

    [property: JsonPropertyName("bestOverall")]
    BestOverall? BestOverall,

    [property: JsonPropertyName("bestFor")]
    List<BestForRecommendation> BestFor,

    [property: JsonPropertyName("keyDifferences")]
    List<string> KeyDifferences,

    [property: JsonPropertyName("missingInformation")]
    List<MissingInformation> MissingInformation,

    [property: JsonPropertyName("sources")]
    List<SourceAttribution> Sources
);

public record ItemSummary(
    [property: JsonPropertyName("id")]
    string Id,

    [property: JsonPropertyName("displayName")]
    string DisplayName,

    [property: JsonPropertyName("shortDescription")]
    string ShortDescription
);

public record CriterionEvaluation(
    [property: JsonPropertyName("name")]
    string Name,

    [property: JsonPropertyName("importance")]
    string Importance,

    [property: JsonPropertyName("values")]
    List<CriterionValue> Values,

    [property: JsonPropertyName("winnerItemIds")]
    List<string> WinnerItemIds
);

public record CriterionValue(
    [property: JsonPropertyName("itemId")]
    string ItemId,

    [property: JsonPropertyName("value")]
    string Value,

    [property: JsonPropertyName("confidence")]
    string Confidence
);

public record BestOverall(
    [property: JsonPropertyName("itemId")]
    string? ItemId,

    [property: JsonPropertyName("reason")]
    string Reason
);

public record BestForRecommendation(
    [property: JsonPropertyName("label")]
    string Label,

    [property: JsonPropertyName("itemId")]
    string ItemId,

    [property: JsonPropertyName("reason")]
    string Reason
);

public record MissingInformation(
    [property: JsonPropertyName("itemId")]
    string ItemId,

    [property: JsonPropertyName("fields")]
    List<string> Fields
);

public record SourceAttribution(
    [property: JsonPropertyName("itemId")]
    string ItemId,

    [property: JsonPropertyName("url")]
    string? Url,

    [property: JsonPropertyName("domain")]
    string? Domain
);

public record ApiErrorResponse(
    [property: JsonPropertyName("code")]
    string Code,

    [property: JsonPropertyName("message")]
    string Message,

    [property: JsonPropertyName("details")]
    object? Details = null
);
