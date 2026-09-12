using Backend.Services;
using Xunit;

namespace Backend.Tests;

public class TruncationTests
{
    [Fact]
    public void TruncateIntelligently_WhenTextIsUnderCap_ReturnsOriginalText()
    {
        string text = "This is a short sample text under 4000 characters.";
        string result = ComparisonService.TruncateIntelligently(text, 4000);

        Assert.Equal(text, result);
    }

    [Fact]
    public void TruncateIntelligently_WhenTextExceedsCap_TruncatesToUnderCapWithEllipsis()
    {
        string longText = new string('a', 4500);
        string result = ComparisonService.TruncateIntelligently(longText, 4000);

        Assert.True(result.Length <= 4000);
        Assert.EndsWith("...", result);
    }

    [Fact]
    public void TruncateIntelligently_BreaksAtSentenceBoundary_WhenAvailableNearLimit()
    {
        // 3900 chars of filler + sentence ending at ~3934 + 600 chars of excessive text = 4534 chars total (> 4000)
        string filler = new string('x', 3900);
        string sentence = " This is the end of the sentence.";
        string excessive = new string('y', 600);
        string input = filler + sentence + excessive;

        string result = ComparisonService.TruncateIntelligently(input, 4000);

        Assert.True(result.Length <= 4000);
        Assert.EndsWith("sentence....", result);
    }
}
