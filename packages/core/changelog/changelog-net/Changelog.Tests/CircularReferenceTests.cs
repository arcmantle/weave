using System;
using System.Collections.Generic;
using Xunit;

namespace Changelog.Tests;

/// <summary>
/// Tests for circular reference detection in DiffEngine
/// </summary>
public class CircularReferenceTests {
	[Fact]
	public void Diff_WithSelfReferencingObject_ShouldNotStackOverflow() {
		// Arrange
		var obj = new Dictionary<string, object?> { { "name", "test" } };
		obj["self"] = obj; // Circular reference to itself

		// Act - Should not throw StackOverflowException
		var diffs = DiffEngine.Diff(obj, obj);

		// Assert
		Assert.Empty(diffs); // Same object, no changes
	}

	[Fact]
	public void Diff_WithMutuallyReferencingObjects_ShouldNotStackOverflow() {
		// Arrange
		var obj1 = new Dictionary<string, object?> { { "id", 1 } };
		var obj2 = new Dictionary<string, object?> { { "id", 2 } };
		obj1["partner"] = obj2;
		obj2["partner"] = obj1;

		// Act - Should not throw StackOverflowException
		var diffs = DiffEngine.Diff(obj1, obj1);

		// Assert
		Assert.Empty(diffs); // Same structure, no changes
	}

	[Fact]
	public void Diff_WithCircularListReferences_ShouldNotStackOverflow() {
		// Arrange
		var list1 = new List<object?> { "item1" };
		var list2 = new List<object?> { "item2" };
		list1.Add(list2);
		list2.Add(list1);

		// Act - Should not throw StackOverflowException
		var diffs = DiffEngine.Diff(list1, list1);

		// Assert
		Assert.Empty(diffs); // Same list, no changes
	}

	[Fact]
	public void Diff_WithDeepCircularChain_ShouldNotStackOverflow() {
		// Arrange - Create A -> B -> C -> A cycle
		var a = new Dictionary<string, object?> { { "name", "A" } };
		var b = new Dictionary<string, object?> { { "name", "B" } };
		var c = new Dictionary<string, object?> { { "name", "C" } };

		a["next"] = b;
		b["next"] = c;
		c["next"] = a; // Completes the cycle

		// Act - Should not throw StackOverflowException
		var diffs = DiffEngine.Diff(a, a);

		// Assert
		Assert.Empty(diffs); // Same structure, no changes
	}

	[Fact]
	public void Diff_WithCircularReferencesAndChanges_ShouldDetectNonCircularChanges() {
		// Arrange
		var old = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "value", "old" }
		};
		old["self"] = old;

		var newObj = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "value", "new" } // Changed value
		};
		newObj["self"] = newObj;

		// Act
		var diffs = DiffEngine.Diff(old, newObj);

		// Assert
		Assert.Single(diffs);
		Assert.Equal(new[] { "value" }, diffs[0].Path);
		Assert.Equal(DiffKind.Changed, diffs[0].Kind);
		Assert.Equal("old", diffs[0].OldValue);
		Assert.Equal("new", diffs[0].NewValue);
	}

	[Fact]
	public void Diff_WithEntityLikeCircularReferences_ShouldHandleOrmScenario() {
		// Arrange - Simulates ORM entities with bidirectional relationships
		var user = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "name", "Alice" },
			{ "posts", new List<object?>() }
		};

		var post = new Dictionary<string, object?> {
			{ "id", 100 },
			{ "title", "First Post" },
			{ "author", user }
		};

		((List<object?>)user["posts"]!).Add(post);

		// Act - Should not throw StackOverflowException
		var diffs = DiffEngine.Diff(user, user);

		// Assert
		Assert.Empty(diffs); // Same object graph, no changes
	}

	[Fact]
	public void Diff_WithComplexGraphAndCircularReferences_ShouldDetectChanges() {
		// Arrange - Create two separate but structurally similar circular graphs
		var oldUser = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "name", "Alice" },
			{ "posts", new List<object?>() }
		};

		var oldPost = new Dictionary<string, object?> {
			{ "id", 100 },
			{ "title", "Old Title" },
			{ "author", oldUser }
		};
		((List<object?>)oldUser["posts"]!).Add(oldPost);

		var newUser = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "name", "Alice" },
			{ "posts", new List<object?>() }
		};

		var newPost = new Dictionary<string, object?> {
			{ "id", 100 },
			{ "title", "New Title" }, // Changed
			{ "author", newUser }
		};
		((List<object?>)newUser["posts"]!).Add(newPost);

		// Act
		var diffs = DiffEngine.Diff(oldUser, newUser);

		// Assert - Should detect the title change
		Assert.Single(diffs);
		Assert.Equal(new[] { "posts", "0", "title" }, diffs[0].Path);
		Assert.Equal(DiffKind.Changed, diffs[0].Kind);
		Assert.Equal("Old Title", diffs[0].OldValue);
		Assert.Equal("New Title", diffs[0].NewValue);
	}

	[Fact]
	public void Diff_WithMixedCircularAndNonCircularReferences_ShouldHandleBoth() {
		// Arrange
		var shared = new Dictionary<string, object?> { { "id", 999 } };
		shared["self"] = shared; // Circular

		var oldContainer = new Dictionary<string, object?> {
			{ "value", "old" },
			{ "shared", shared }
		};

		var newContainer = new Dictionary<string, object?> {
			{ "value", "new" }, // Changed
			{ "shared", shared } // Same shared object
		};

		// Act
		var diffs = DiffEngine.Diff(oldContainer, newContainer);

		// Assert
		Assert.Single(diffs);
		Assert.Equal(new[] { "value" }, diffs[0].Path);
		Assert.Equal("old", diffs[0].OldValue);
		Assert.Equal("new", diffs[0].NewValue);
	}

	[Fact]
	public void Diff_WithNullAndCircularReferences_ShouldHandle() {
		// Arrange
		var obj = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "nullable", null }
		};
		obj["self"] = obj;

		var changed = new Dictionary<string, object?> {
			{ "id", 1 },
			{ "nullable", "now has value" }
		};
		changed["self"] = changed;

		// Act
		var diffs = DiffEngine.Diff(obj, changed);

		// Assert
		Assert.Single(diffs);
		Assert.Equal(new[] { "nullable" }, diffs[0].Path);
		Assert.Equal(DiffKind.Changed, diffs[0].Kind);
		Assert.Null(diffs[0].OldValue);
		Assert.Equal("now has value", diffs[0].NewValue);
	}
}
