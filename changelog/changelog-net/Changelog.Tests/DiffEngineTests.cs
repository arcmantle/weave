using System;
using System.Collections.Generic;
using Xunit;
using FluentAssertions;

namespace Changelog.Tests;

public class DiffEngineTests {
	[Fact]
	public void Diff_DetectsNoChanges_ForIdenticalPrimitives() {
		// Assert
		DiffEngine.Diff(42, 42).Should().BeEmpty();
		DiffEngine.Diff("hello", "hello").Should().BeEmpty();
		DiffEngine.Diff(true, true).Should().BeEmpty();
		DiffEngine.Diff(null, null).Should().BeEmpty();
	}

	[Fact]
	public void Diff_DetectsChanges_InPrimitives() {
		// Act
		var result = DiffEngine.Diff(42, 43);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = Array.Empty<string>(),
			Kind = DiffKind.Changed,
			OldValue = 42,
			NewValue = 43
		});
	}

	[Fact]
	public void Diff_DetectsAddedProperties() {
		// Act
		var result = DiffEngine.Diff(
			new { },
			new { name = "Alice" }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "name" },
			Kind = DiffKind.Added,
			NewValue = "Alice"
		});
	}

	[Fact]
	public void Diff_DetectsRemovedProperties() {
		// Act
		var result = DiffEngine.Diff(
			new { name = "Alice" },
			new { }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "name" },
			Kind = DiffKind.Removed,
			OldValue = "Alice"
		});
	}

	[Fact]
	public void Diff_DetectsChangedProperties() {
		// Act
		var result = DiffEngine.Diff(
			new { name = "Alice" },
			new { name = "Bob" }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "name" },
			Kind = DiffKind.Changed,
			OldValue = "Alice",
			NewValue = "Bob"
		});
	}

	[Fact]
	public void Diff_DetectsDeepNestedChanges() {
		// Arrange
		var oldValue = new {
			user = new {
				profile = new {
					name = "Alice",
					age = 30
				}
			}
		};

		var newValue = new {
			user = new {
				profile = new {
					name = "Alice",
					age = 31
				}
			}
		};

		// Act
		var result = DiffEngine.Diff(oldValue, newValue);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "user", "profile", "age" },
			Kind = DiffKind.Changed,
			OldValue = 30,
			NewValue = 31
		});
	}

	[Fact]
	public void Diff_DetectsMultipleChanges_AtDifferentDepths() {
		// Arrange
		var oldValue = new Dictionary<string, object> {
			["a"] = 1,
			["b"] = new Dictionary<string, object> {
				["c"] = 2,
				["d"] = new Dictionary<string, object> {
					["e"] = 3
				}
			}
		};

		var newValue = new Dictionary<string, object> {
			["a"] = 10,
			["b"] = new Dictionary<string, object> {
				["c"] = 2,
				["d"] = new Dictionary<string, object> {
					["e"] = 30,
					["f"] = 40
				}
			}
		};

		// Act
		var result = DiffEngine.Diff(oldValue, newValue);

		// Assert
		result.Should().Contain(r => r.Path.SequenceEqual(new[] { "a" }) && r.Kind == DiffKind.Changed);
		result.Should().Contain(r => r.Path.SequenceEqual(new[] { "b", "d", "e" }) && r.Kind == DiffKind.Changed);
		result.Should().Contain(r => r.Path.SequenceEqual(new[] { "b", "d", "f" }) && r.Kind == DiffKind.Added);
	}

	[Fact]
	public void Diff_HandlesArrays_WithAddedElements() {
		// Act
		var result = DiffEngine.Diff(
			new List<int> { 1, 2 },
			new List<int> { 1, 2, 3 }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "2" },
			Kind = DiffKind.Added,
			NewValue = 3
		});
	}

	[Fact]
	public void Diff_HandlesArrays_WithRemovedElements() {
		// Act
		var result = DiffEngine.Diff(
			new List<int> { 1, 2, 3 },
			new List<int> { 1, 2 }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "2" },
			Kind = DiffKind.Removed,
			OldValue = 3
		});
	}

	[Fact]
	public void Diff_HandlesArrays_WithChangedElements() {
		// Act
		var result = DiffEngine.Diff(
			new List<int> { 1, 2, 3 },
			new List<int> { 1, 20, 3 }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "1" },
			Kind = DiffKind.Changed,
			OldValue = 2,
			NewValue = 20
		});
	}

	[Fact]
	public void Diff_HandlesNestedObjects_InArrays() {
		// Arrange
		var oldValue = new List<object> { new { id = 1, name = "Alice" } };
		var newValue = new List<object> { new { id = 1, name = "Bob" } };

		// Act
		var result = DiffEngine.Diff(oldValue, newValue);

		// Assert
		result.Should().ContainSingle().Which.Path.Should().Equal("0", "name");
	}

	[Fact]
	public void Diff_DetectsTypeChanges() {
		// Act
		var result = DiffEngine.Diff(
			new { value = (object)42 },
			new { value = (object)"string" }
		);

		// Assert
		result.Should().ContainSingle().Which.Should().BeEquivalentTo(new DiffRecord {
			Path = new[] { "value" },
			Kind = DiffKind.Changed,
			OldValue = 42,
			NewValue = "string"
		});
	}

	[Fact]
	public void ApplyDiff_AppliesChanges_ToPrimitives() {
		// Arrange
		var diffs = new List<DiffRecord>
		{
			new() { Path = Array.Empty<string>(), Kind = DiffKind.Changed, OldValue = 42, NewValue = 43 }
		};

		// Act
		var result = DiffEngine.ApplyDiff(42, diffs);

		// Assert
		result.Should().Be(43);
	}

	[Fact]
	public void ApplyDiff_AddsNewProperties() {
		// Arrange
		var original = new Dictionary<string, object> { ["existing"] = "value" };
		var diffs = new List<DiffRecord>
		{
			new() { Path = new[] { "newProp" }, Kind = DiffKind.Added, NewValue = "newValue" }
		};

		// Act
		var result = DiffEngine.ApplyDiff(original, diffs) as Dictionary<string, object>;

		// Assert
		result.Should().ContainKey("newProp").WhoseValue.Should().Be("newValue");
		result.Should().ContainKey("existing").WhoseValue.Should().Be("value");
	}

	[Fact]
	public void ApplyDiff_RemovesProperties() {
		// Arrange
		var original = new Dictionary<string, object> {
			["keep"] = "this",
			["remove"] = "that"
		};
		var diffs = new List<DiffRecord>
		{
			new() { Path = new[] { "remove" }, Kind = DiffKind.Removed, OldValue = "that" }
		};

		// Act
		var result = DiffEngine.ApplyDiff(original, diffs) as Dictionary<string, object>;

		// Assert
		result.Should().ContainKey("keep");
		result.Should().NotContainKey("remove");
	}

	[Fact]
	public void ApplyDiff_ModifiesNestedValues() {
		// Arrange
		var original = new Dictionary<string, object> {
			["user"] = new Dictionary<string, object> {
				["name"] = "Alice",
				["age"] = 30
			}
		};

		var diffs = new List<DiffRecord>
		{
			new() { Path = new[] { "user", "age" }, Kind = DiffKind.Changed, OldValue = 30, NewValue = 31 }
		};

		// Act
		var result = DiffEngine.ApplyDiff(original, diffs) as Dictionary<string, object>;
		var user = result!["user"] as Dictionary<string, object>;

		// Assert
		user!["age"].Should().Be(31);
		user["name"].Should().Be("Alice");
	}

	[Fact]
	public void ApplyDiff_HandlesArrayModifications() {
		// Arrange
		var original = new List<int> { 1, 2, 3 };
		var diffs = new List<DiffRecord>
		{
			new() { Path = new[] { "1" }, Kind = DiffKind.Changed, OldValue = 2, NewValue = 20 }
		};

		// Act
		var result = DiffEngine.ApplyDiff(original, diffs) as List<object>;

		// Assert
		result.Should().HaveCount(3);
		result![1].Should().Be(20);
	}

	[Fact]
	public void ApplyDiff_RemovesArrayElements_InCorrectOrder() {
		// Arrange
		var original = new List<int> { 1, 2, 3, 4, 5 };
		var diffs = new List<DiffRecord>
		{
			new() { Path = new[] { "1" }, Kind = DiffKind.Removed, OldValue = 2 },
			new() { Path = new[] { "3" }, Kind = DiffKind.Removed, OldValue = 4 }
		};

		// Act
		var result = DiffEngine.ApplyDiff(original, diffs) as List<object>;

		// Assert
		result.Should().Equal(1, 3, 5);
	}
}
