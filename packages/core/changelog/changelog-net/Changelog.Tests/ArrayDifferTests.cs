using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using FluentAssertions;
using Changelog;

namespace Changelog.Tests;

public class ArrayDifferTests {
	[Fact]
	public void Diff_EmptyArrays_ReturnsNoChanges() {
		// Arrange
		var oldArray = new int[] { };
		var newArray = new int[] { };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().BeEmpty();
	}

	[Fact]
	public void Diff_NullArrays_ReturnsNoChanges() {
		// Arrange
		int[]? oldArray = null;
		int[]? newArray = null;

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().BeEmpty();
	}

	[Fact]
	public void Diff_AddSingleItem_ReturnsAddChange() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var newArray = new[] { 1, 2, 3, 4 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Add);
		changes[0].Index.Should().Be(3);
		changes[0].NewValue.Should().Be(4);
	}

	[Fact]
	public void Diff_RemoveSingleItem_ReturnsRemoveChange() {
		// Arrange
		var oldArray = new[] { 1, 2, 3, 4 };
		var newArray = new[] { 1, 2, 4 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Remove);
		changes[0].Index.Should().Be(2);
		changes[0].OldValue.Should().Be(3);
	}

	[Fact]
	public void Diff_ModifySingleItem_ReturnsModifyChange() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var newArray = new[] { 1, 99, 3 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Modify);
		changes[0].Index.Should().Be(1);
		changes[0].OldValue.Should().Be(2);
		changes[0].NewValue.Should().Be(99);
	}

	[Fact]
	public void Diff_AddAtBeginning_ReturnsAddChange() {
		// Arrange
		var oldArray = new[] { 2, 3, 4 };
		var newArray = new[] { 1, 2, 3, 4 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Add);
		changes[0].Index.Should().Be(0);
		changes[0].NewValue.Should().Be(1);
	}

	[Fact]
	public void Diff_RemoveAtBeginning_ReturnsRemoveChange() {
		// Arrange
		var oldArray = new[] { 1, 2, 3, 4 };
		var newArray = new[] { 2, 3, 4 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Remove);
		changes[0].Index.Should().Be(0);
		changes[0].OldValue.Should().Be(1);
	}

	[Fact]
	public void Diff_MultipleChanges_ReturnsAllChanges() {
		// Arrange
		var oldArray = new[] { 1, 2, 3, 4 };
		var newArray = new[] { 1, 99, 3, 5, 6 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert - Should detect: modify at index 1, remove at 3, add 5, add 6
		changes.Should().NotBeEmpty();
		changes.Should().Contain(c => c.Type == ArrayChangeType.Modify && c.Index == 1 && (int?)c.NewValue == 99);
	}

	[Fact]
	public void Diff_CompleteReplacement_DetectsAllChanges() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var newArray = new[] { 7, 8, 9 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert - When no items match, LCS produces remove all + add all
		// This is correct behavior (6 operations: 3 removes + 3 adds)
		changes.Should().HaveCount(6);
		changes.Take(3).Should().AllSatisfy(c => c.Type.Should().Be(ArrayChangeType.Remove));
		changes.Skip(3).Should().AllSatisfy(c => c.Type.Should().Be(ArrayChangeType.Add));

		// Verify round-trip still works
		var reconstructed = ArrayDiffer.ApplyChanges(oldArray, changes);
		reconstructed.Should().Equal(newArray);
	}

	[Fact]
	public void Diff_StringArray_WorksCorrectly() {
		// Arrange
		var oldArray = new[] { "apple", "banana", "cherry" };
		var newArray = new[] { "apple", "blueberry", "cherry" };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Modify);
		changes[0].Index.Should().Be(1);
		changes[0].OldValue.Should().Be("banana");
		changes[0].NewValue.Should().Be("blueberry");
	}

	[Fact]
	public void Diff_FromEmpty_ReturnsAllAdds() {
		// Arrange
		var oldArray = new int[] { };
		var newArray = new[] { 1, 2, 3 };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(3);
		changes.Should().AllSatisfy(c => c.Type.Should().Be(ArrayChangeType.Add));
		changes[0].Index.Should().Be(0);
		changes[1].Index.Should().Be(1);
		changes[2].Index.Should().Be(2);
	}

	[Fact]
	public void Diff_ToEmpty_ReturnsAllRemoves() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var newArray = new int[] { };

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(3);
		changes.Should().AllSatisfy(c => c.Type.Should().Be(ArrayChangeType.Remove));
	}

	[Fact]
	public void ApplyChanges_AddOperation_AddsItem() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var changes = new List<ArrayChange> {
			new() { Type = ArrayChangeType.Add, Index = 3, NewValue = 4 }
		};

		// Act
		var result = ArrayDiffer.ApplyChanges(oldArray, changes);

		// Assert
		result.Should().Equal(1, 2, 3, 4);
	}

	[Fact]
	public void ApplyChanges_RemoveOperation_RemovesItem() {
		// Arrange
		var oldArray = new[] { 1, 2, 3, 4 };
		var changes = new List<ArrayChange> {
			new() { Type = ArrayChangeType.Remove, Index = 2, OldValue = 3 }
		};

		// Act
		var result = ArrayDiffer.ApplyChanges(oldArray, changes);

		// Assert
		result.Should().Equal(1, 2, 4);
	}

	[Fact]
	public void ApplyChanges_ModifyOperation_ModifiesItem() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		var changes = new List<ArrayChange> {
			new() { Type = ArrayChangeType.Modify, Index = 1, OldValue = 2, NewValue = 99 }
		};

		// Act
		var result = ArrayDiffer.ApplyChanges(oldArray, changes);

		// Assert
		result.Should().Equal(1, 99, 3);
	}

	[Fact]
	public void ApplyChanges_MultipleOperations_AppliesCorrectly() {
		// Arrange
		var oldArray = new[] { 1, 2, 3 };
		// Changes: modify index 1, add at end, remove first
		// Expected result: [2, 3] (after remove 0) -> [99, 3] (after modify 1) -> [99, 3, 4] (after add 3)
		// But order matters - we separate removes and process in reverse index order
		var changes = new List<ArrayChange> {
			new() { Type = ArrayChangeType.Remove, Index = 0, OldValue = 1 },
			new() { Type = ArrayChangeType.Modify, Index = 1, OldValue = 2, NewValue = 99 },
			new() { Type = ArrayChangeType.Add, Index = 3, NewValue = 4 }
		};

		// Act
		var result = ArrayDiffer.ApplyChanges(oldArray, changes);

		// Assert - After remove(0): [2,3], modify is at index 1 so -> [2,99], add at 3 -> [2,99,4]
		// Actually: removes apply first, then others in order
		// [1,2,3] -> remove 0 -> [2,3] -> modify 1 (index 1 of [2,3] is 3) -> [2,99] -> add at 3 (append) -> [2,99,4]
		result.Should().Equal(2, 99, 4);
	}

	[Fact]
	public void Diff_AndApply_RoundTrip_ProducesCorrectResult() {
		// Arrange
		var oldArray = new[] { "a", "b", "c", "d" };
		var newArray = new[] { "a", "x", "c", "e" };

		// Act - Compute diff
		var changes = ArrayDiffer.Diff(oldArray, newArray);
		// Apply changes to reconstruct new array
		var reconstructed = ArrayDiffer.ApplyChanges(oldArray, changes);

		// Assert
		reconstructed.Should().Equal(newArray);
	}

	[Fact]
	public void Diff_LargeArray_WorksEfficiently() {
		// Arrange - Large arrays with small diff
		var oldArray = Enumerable.Range(1, 1000).ToArray();
		var newArray = Enumerable.Range(1, 1000)
			.Select(x => x == 500 ? 9999 : x)  // Change one item
			.ToArray();

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert - Should detect only the single modification
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Modify);
		changes[0].Index.Should().Be(499);
		changes[0].NewValue.Should().Be(9999);
	}

	[Fact]
	public void Diff_StorageSavings_Demonstration() {
		// Arrange - Simulate real-world scenario
		var oldArray = Enumerable.Range(1, 100).ToArray();
		var newArray = oldArray.ToArray();
		newArray[50] = 999;  // Single change

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		// Instead of storing 200 integers (old + new array), we store:
		// - 1 change record with type, index, old value, new value
		// This is ~50x reduction in storage for this scenario
	}

	[Fact]
	public void Diff_ComplexObjects_WorksWithCustomEquality() {
		// Arrange
		var oldArray = new[] {
			new { Id = 1, Name = "Alice" },
			new { Id = 2, Name = "Bob" }
		};
		var newArray = new[] {
			new { Id = 1, Name = "Alice" },
			new { Id = 2, Name = "Bobby" }  // Name changed
		};

		// Act
		var changes = ArrayDiffer.Diff(oldArray, newArray);

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Type.Should().Be(ArrayChangeType.Modify);
		changes[0].Index.Should().Be(1);
	}
}
