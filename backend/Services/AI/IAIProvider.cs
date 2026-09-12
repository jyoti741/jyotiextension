using Backend.DTOs;
using Backend.Models.AI;

namespace Backend.Services.AI;

public interface IAIProvider
{
    string ProviderName { get; }
    AIComparisonResult? LastTelemetry { get; }
    Task<CompareResponse> CompareAsync(CompareRequest request, CancellationToken ct = default);
}
