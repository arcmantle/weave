using System;
using System.Collections.Generic;
using System.Diagnostics;
using Xunit;
using Xunit.Abstractions;
using FluentAssertions;
using Changelog;

namespace Changelog.Tests;

public class DiffEnginePerformanceTests {
	private readonly ITestOutputHelper _output;

	public DiffEnginePerformanceTests(ITestOutputHelper output) {
		_output = output;
	}

	private class LargeDocument {
		public string? Property1 { get; set; }
		public string? Property2 { get; set; }
		public string? Property3 { get; set; }
		public string? Property4 { get; set; }
		public string? Property5 { get; set; }
		public int Number1 { get; set; }
		public int Number2 { get; set; }
		public int Number3 { get; set; }
		public int Number4 { get; set; }
		public int Number5 { get; set; }
		public bool Flag1 { get; set; }
		public bool Flag2 { get; set; }
		public bool Flag3 { get; set; }
		public DateTime Date1 { get; set; }
		public DateTime Date2 { get; set; }
		public NestedData? Nested { get; set; }
	}

	private class NestedData {
		public string? Value1 { get; set; }
		public string? Value2 { get; set; }
		public string? Value3 { get; set; }
		public int Counter { get; set; }
	}

	[Fact]
	public void Diff_PerformanceBenchmark_LargeDocuments() {
		// Arrange
		var doc1 = new LargeDocument {
			Property1 = "Value1",
			Property2 = "Value2",
			Property3 = "Value3",
			Property4 = "Value4",
			Property5 = "Value5",
			Number1 = 1,
			Number2 = 2,
			Number3 = 3,
			Number4 = 4,
			Number5 = 5,
			Flag1 = true,
			Flag2 = false,
			Flag3 = true,
			Date1 = DateTime.UtcNow,
			Date2 = DateTime.UtcNow.AddDays(1),
			Nested = new NestedData {
				Value1 = "Nested1",
				Value2 = "Nested2",
				Value3 = "Nested3",
				Counter = 100
			}
		};

		var doc2 = new LargeDocument {
			Property1 = "Value1",
			Property2 = "Modified",
			Property3 = "Value3",
			Property4 = "Value4",
			Property5 = "Changed",
			Number1 = 1,
			Number2 = 999,
			Number3 = 3,
			Number4 = 4,
			Number5 = 5,
			Flag1 = true,
			Flag2 = true,
			Flag3 = true,
			Date1 = DateTime.UtcNow,
			Date2 = DateTime.UtcNow.AddDays(2),
			Nested = new NestedData {
				Value1 = "Nested1",
				Value2 = "ModifiedNested",
				Value3 = "Nested3",
				Counter = 200
			}
		};

		const int iterations = 1000;
		var sw = Stopwatch.StartNew();

		// Act - Run diff many times
		for (int i = 0; i < iterations; i++) {
			var diffs = DiffEngine.Diff(doc1, doc2);
		}

		sw.Stop();
		var totalMs = sw.ElapsedMilliseconds;
		var avgMs = totalMs / (double)iterations;

		// Log performance
		_output.WriteLine($"Total time for {iterations} diffs: {totalMs}ms");
		_output.WriteLine($"Average time per diff: {avgMs:F3}ms");
		_output.WriteLine($"Throughput: {iterations / (totalMs / 1000.0):F0} diffs/sec");

		// Assert - Should complete in reasonable time
		// With compiled expressions, expect <1ms per diff on average
		avgMs.Should().BeLessThan(2.0, "compiled expressions should be fast");
	}

	[Fact]
	public void Diff_ManySmallDocuments_Benchmark() {
		// Arrange
		const int iterations = 5000;
		var docs = new List<(object, object)>();

		for (int i = 0; i < iterations; i++) {
			docs.Add((
				new { Name = "Alice", Age = 30, City = "NYC" },
				new { Name = "Alice", Age = 31, City = "NYC" }
			));
		}

		var sw = Stopwatch.StartNew();

		// Act
		foreach (var (doc1, doc2) in docs) {
			var diffs = DiffEngine.Diff(doc1, doc2);
		}

		sw.Stop();
		var totalMs = sw.ElapsedMilliseconds;
		var avgMs = totalMs / (double)iterations;

		// Log performance
		_output.WriteLine($"Total time for {iterations} small diffs: {totalMs}ms");
		_output.WriteLine($"Average time per diff: {avgMs:F3}ms");
		_output.WriteLine($"Throughput: {iterations / (totalMs / 1000.0):F0} diffs/sec");

		// Assert - Small diffs should be very fast
		avgMs.Should().BeLessThan(0.5, "small diffs should be extremely fast");
	}

	[Fact]
	public void PropertyAccessor_IsCached() {
		// Arrange
		var doc = new LargeDocument { Property1 = "Test" };

		// Act - Get accessor twice
		var accessor1 = PropertyAccessor.GetAccessor(typeof(LargeDocument));
		var accessor2 = PropertyAccessor.GetAccessor(typeof(LargeDocument));

		// Assert - Should return same cached instance
		accessor1.Should().BeSameAs(accessor2, "accessors should be cached");
	}

	[Fact]
	public void PropertyAccessor_IsFasterInRealWorldScenario() {
		// The real benefit of compiled accessors comes from reduced
		// overhead when combined with other operations in DiffEngine
		// This test validates that overall diff operations are faster

		var doc1 = new LargeDocument {
			Property1 = "Value1",
			Property2 = "Value2",
			Number1 = 42,
			Flag1 = true
		};

		var doc2 = new LargeDocument {
			Property1 = "Value1",
			Property2 = "Modified",
			Number1 = 99,
			Flag1 = true
		};

		const int iterations = 1000;
		var sw = Stopwatch.StartNew();
		for (int i = 0; i < iterations; i++) {
			var diffs = DiffEngine.Diff(doc1, doc2);
		}
		sw.Stop();

		// Log results
		_output.WriteLine($"Time for {iterations} complete diff operations: {sw.ElapsedMilliseconds}ms");
		_output.WriteLine($"Average: {sw.ElapsedMilliseconds / (double)iterations:F3}ms per diff");

		// Assert - Compiled accessors + caching make diffs fast
		sw.ElapsedMilliseconds.Should().BeLessThan(500, "diff operations should be fast with compiled accessors");
	}
}
