using System.ComponentModel.DataAnnotations;
using Backend.DTOs;
using Xunit;

namespace Backend.Tests;

public class PayloadValidationTests
{
    private IList<ValidationResult> ValidateModel(object model)
    {
        var results = new List<ValidationResult>();
        var context = new ValidationContext(model, serviceProvider: null, items: null);
        Validator.TryValidateObject(model, context, results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void CompareRequest_WithMissingInstallId_FailsValidation()
    {
        var request = new CompareRequest(
            InstallId: "",
            Goal: null,
            Pages: new List<PageSnapshot>
            {
                new("1", "https://example.com/1", "example.com", "Page 1", "Content 1"),
                new("2", "https://example.com/2", "example.com", "Page 2", "Content 2")
            }
        );

        var results = ValidateModel(request);
        Assert.Contains(results, r => r.MemberNames.Contains("InstallId"));
    }

    [Fact]
    public void CompareRequest_WithFewerThan2Pages_FailsValidation()
    {
        var request = new CompareRequest(
            InstallId: "install_123",
            Goal: null,
            Pages: new List<PageSnapshot>
            {
                new("1", "https://example.com/1", "example.com", "Page 1", "Content 1")
            }
        );

        var results = ValidateModel(request);
        Assert.Contains(results, r => r.ErrorMessage != null && r.ErrorMessage.Contains("At least 2 pages"));
    }

    [Fact]
    public void CompareRequest_WithMoreThan4Pages_FailsValidation()
    {
        var request = new CompareRequest(
            InstallId: "install_123",
            Goal: null,
            Pages: new List<PageSnapshot>
            {
                new("1", "https://example.com/1", "example.com", "Page 1", "Content 1"),
                new("2", "https://example.com/2", "example.com", "Page 2", "Content 2"),
                new("3", "https://example.com/3", "example.com", "Page 3", "Content 3"),
                new("4", "https://example.com/4", "example.com", "Page 4", "Content 4"),
                new("5", "https://example.com/5", "example.com", "Page 5", "Content 5")
            }
        );

        var results = ValidateModel(request);
        Assert.Contains(results, r => r.ErrorMessage != null && r.ErrorMessage.Contains("maximum of 4 pages"));
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void CompareRequest_With2To4Pages_PassesValidation(int pageCount)
    {
        var pages = new List<PageSnapshot>();
        for (int i = 1; i <= pageCount; i++)
        {
            pages.Add(new PageSnapshot(i.ToString(), $"https://example.com/{i}", "example.com", $"Page {i}", $"Content {i}"));
        }

        var request = new CompareRequest(
            InstallId: "install_valid_123",
            Goal: "Find best value",
            Pages: pages
        );

        var results = ValidateModel(request);
        Assert.Empty(results);
    }
}
