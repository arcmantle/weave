using Pivot.Extensions;

namespace Pivot.Core.Tests;


public class SanitizeVersionTests {
	[Theory]
	[InlineData("3.2.1", "3.2.1")]
	[InlineData("v3.2.1", "3.2.1")]
	[InlineData("3.2.1-beta.1", "3.2.1")]
	[InlineData("3.2.1+build.123", "3.2.1")]
	[InlineData("v3.2.1-rc.1+sha.abc", "3.2.1")]
	[InlineData("1.0.0", "1.0.0")]
	[InlineData("0.1.0-alpha", "0.1.0")]
	public void Strips_prerelease_and_build_metadata(string input, string expected) {
		var result = PivotClientPluginExtensions.SanitizeVersion(input);

		Assert.Equal(expected, result);
	}

	[Fact]
	public void Handles_version_with_no_metadata() {
		var result = PivotClientPluginExtensions.SanitizeVersion("2.0.0");

		Assert.Equal("2.0.0", result);
	}

	[Fact]
	public void Strips_leading_v_only() {
		var result = PivotClientPluginExtensions.SanitizeVersion("v1.2.3");

		Assert.Equal("1.2.3", result);
	}

	[Fact]
	public void Strips_prerelease_before_build_metadata() {
		var result = PivotClientPluginExtensions.SanitizeVersion("1.0.0-beta.2+sha.deadbeef");

		Assert.Equal("1.0.0", result);
	}
}
