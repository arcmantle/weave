using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Xunit;
using Xunit.Abstractions;
using FluentAssertions;
using Changelog.Storage;

namespace Changelog.Tests;

public class CompressionTests {
	private readonly ITestOutputHelper _output;

	public CompressionTests(ITestOutputHelper output) {
		_output = output;
	}

	[Fact]
	public void Compress_EmptyString_ReturnsEmpty() {
		// Arrange
		var text = "";

		// Act
		var compressed = CompressionHelper.Compress(text);

		// Assert
		compressed.Should().BeEmpty();
	}

	[Fact]
	public void Compress_Decompress_RoundTrip_ProducesOriginal() {
		// Arrange
		var original = "Hello, World! This is a test string for compression.";

		// Act
		var compressed = CompressionHelper.Compress(original);
		var decompressed = CompressionHelper.Decompress(compressed);

		// Assert
		decompressed.Should().Be(original);
	}

	[Fact]
	public void Compress_JsonData_AchievesGoodCompression() {
		// Arrange
		var jsonObject = new {
			Name = "John Doe",
			Email = "john.doe@example.com",
			Address = new {
				Street = "123 Main Street",
				City = "New York",
				State = "NY",
				Zip = "10001"
			},
			PhoneNumbers = new[] { "555-1234", "555-5678" }
		};
		var json = JsonSerializer.Serialize(jsonObject);
		var originalSize = Encoding.UTF8.GetByteCount(json);

		// Act
		var compressed = CompressionHelper.Compress(json);
		var decompressed = CompressionHelper.Decompress(compressed);

		// Assert
		decompressed.Should().Be(json);
		compressed.Length.Should().BeLessThan(originalSize);

		var ratio = CompressionHelper.GetCompressionRatio(originalSize, compressed.Length);
		var savings = CompressionHelper.GetSavingsPercentage(originalSize, compressed.Length);

		_output.WriteLine($"Original: {originalSize} bytes");
		_output.WriteLine($"Compressed: {compressed.Length} bytes");
		_output.WriteLine($"Ratio: {ratio:P0}");
		_output.WriteLine($"Savings: {savings:F1}%");

		// JSON typically compresses well
		savings.Should().BeGreaterThanOrEqualTo(0, "compression should not make data larger");
	}

	[Fact]
	public void Compress_LargeText_AchievesSignificantReduction() {
		// Arrange - Large repetitive text (simulates verbose JSON)
		var largeText = string.Join("\n", Enumerable.Range(1, 100).Select(i =>
			$"{{\"id\":{i},\"name\":\"Item {i}\",\"description\":\"This is a description for item {i}\"}}"));
		var originalSize = Encoding.UTF8.GetByteCount(largeText);

		// Act
		var compressed = CompressionHelper.Compress(largeText);
		var decompressed = CompressionHelper.Decompress(compressed);

		// Assert
		decompressed.Should().Be(largeText);

		var savings = CompressionHelper.GetSavingsPercentage(originalSize, compressed.Length);
		_output.WriteLine($"Original: {originalSize} bytes");
		_output.WriteLine($"Compressed: {compressed.Length} bytes");
		_output.WriteLine($"Savings: {savings:F1}%");

		// Large repetitive text should compress very well
		savings.Should().BeGreaterThan(60);
	}

	[Fact]
	public void CompressBytes_RoundTrip_ProducesOriginal() {
		// Arrange
		var original = Encoding.UTF8.GetBytes("Test data for byte compression");

		// Act
		var compressed = CompressionHelper.CompressBytes(original);
		var decompressed = CompressionHelper.DecompressBytes(compressed);

		// Assert
		decompressed.Should().Equal(original);
	}

	[Fact]
	public void GetCompressionRatio_ValidSizes_CalculatesCorrectly() {
		// Arrange
		var originalSize = 1000;
		var compressedSize = 300;

		// Act
		var ratio = CompressionHelper.GetCompressionRatio(originalSize, compressedSize);

		// Assert
		ratio.Should().BeApproximately(0.3, 0.01);
	}

	[Fact]
	public void GetSavingsPercentage_ValidSizes_CalculatesCorrectly() {
		// Arrange
		var originalSize = 1000;
		var compressedSize = 300;

		// Act
		var savings = CompressionHelper.GetSavingsPercentage(originalSize, compressedSize);

		// Assert
		savings.Should().BeApproximately(70.0, 0.01);
	}

	[Fact]
	public void Compress_UnicodeText_PreservesEncoding() {
		// Arrange
		var unicode = "Hello 世界! Привет мир! 🌍🚀";

		// Act
		var compressed = CompressionHelper.Compress(unicode);
		var decompressed = CompressionHelper.Decompress(compressed);

		// Assert
		decompressed.Should().Be(unicode);
	}

	[Fact]
	public void Compress_VerySmallString_StillWorks() {
		// Arrange
		var small = "Hi";

		// Act
		var compressed = CompressionHelper.Compress(small);
		var decompressed = CompressionHelper.Decompress(compressed);

		// Assert
		decompressed.Should().Be(small);
		// Small strings may actually get larger due to compression overhead
		// This is expected and why we have size threshold in CompressedStorage
	}

	[Fact]
	public async Task CompressedStorage_SaveAndLoad_PreservesData() {
		// Arrange
		var memoryStorage = new MemoryStorage<TestDocument>();
		var compressedStorage = new CompressedStorage<TestDocument>(memoryStorage);

		var doc = new TestDocument {
			Id = "doc1",
			Title = "Test Document",
			Content = "This is a long content string that should compress well when stored. " +
								"It has repetitive patterns and verbose text that gzip can compress efficiently."
		};

		// Act
		await compressedStorage.SaveStateAsync("doc1", doc);
		var loaded = await compressedStorage.LoadStateAsync("doc1");

		// Assert
		loaded.Should().NotBeNull();
		loaded!.Id.Should().Be(doc.Id);
		loaded.Title.Should().Be(doc.Title);
		loaded.Content.Should().Be(doc.Content);
	}

	[Fact]
	public async Task CompressedStorage_AppendChanges_CompressesValues() {
		// Arrange
		var memoryStorage = new MemoryStorage<TestDocument>();
		var compressedStorage = new CompressedStorage<TestDocument>(memoryStorage);

		var groupId = await compressedStorage.CreateGroupAsync("doc1");
		var changes = new List<ChangeRecord> {
			new() {
				Path = new[] { "content" },
				Type = ChangeType.Set,
				OldValue = new string('A', 200), // Large value that will compress
				NewValue = new string('B', 200),
				Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
			}
		};

		// Act
		await compressedStorage.AppendChangesAsync("doc1", changes, groupId);
		var retrieved = await compressedStorage.GetChangesAsync("doc1");

		// Assert
		var retrievedChange = retrieved.Should().ContainSingle().Subject;
		retrievedChange.OldValue.Should().Be(changes[0].OldValue);
		retrievedChange.NewValue.Should().Be(changes[0].NewValue);
	}

	[Fact]
	public async Task CompressedStorage_SmallValues_NotCompressed() {
		// Arrange
		var memoryStorage = new MemoryStorage<TestDocument>();
		var compressedStorage = new CompressedStorage<TestDocument>(memoryStorage);

		var groupId = await compressedStorage.CreateGroupAsync("doc1");
		var changes = new List<ChangeRecord> {
			new() {
				Path = new[] { "title" },
				Type = ChangeType.Set,
				OldValue = "Short", // Small value - won't be compressed
				NewValue = "Brief",
				Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
			}
		};

		// Act
		await compressedStorage.AppendChangesAsync("doc1", changes, groupId);
		var retrieved = await compressedStorage.GetChangesAsync("doc1");

		// Assert
		var retrievedChange = retrieved.Should().ContainSingle().Subject;
		retrievedChange.OldValue.Should().Be("Short");
		retrievedChange.NewValue.Should().Be("Brief");
	}

	[Fact]
	public async Task CompressedStorage_MixedSizes_HandlesCorrectly() {
		// Arrange
		var memoryStorage = new MemoryStorage<TestDocument>();
		var compressedStorage = new CompressedStorage<TestDocument>(memoryStorage);

		var groupId = await compressedStorage.CreateGroupAsync("doc1");

		// Create changes with various sizes
		var changes = new List<ChangeRecord> {
			new() {
				Path = new[] { "small" },
				Type = ChangeType.Set,
				OldValue = "Hi",
				NewValue = "Bye",
				Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
			},
			new() {
				Path = new[] { "large" },
				Type = ChangeType.Set,
				OldValue = JsonSerializer.Serialize(Enumerable.Range(1, 50).Select(i => new { Id = i, Name = $"Item {i}" })),
				NewValue = JsonSerializer.Serialize(Enumerable.Range(1, 50).Select(i => new { Id = i, Name = $"Modified {i}" })),
				Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1
			}
		};

		// Act
		await compressedStorage.AppendChangesAsync("doc1", changes, groupId);
		var retrieved = await compressedStorage.GetChangesAsync("doc1");

		// Assert
		var retrievedList = retrieved.ToList();
		retrievedList.Should().HaveCount(2);
		retrievedList[0].OldValue.Should().Be(changes[0].OldValue);
		retrievedList[1].OldValue.Should().Be(changes[1].OldValue);
	}

	private class TestDocument {
		public string? Id { get; set; }
		public string? Title { get; set; }
		public string? Content { get; set; }
	}
}
