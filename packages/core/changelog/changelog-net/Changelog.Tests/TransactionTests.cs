using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Changelog.Storage;
using Xunit;

namespace Changelog.Tests;

/// <summary>
/// Tests for multi-document transaction support
/// </summary>
public class TransactionTests {
	private class TestDoc {
		public int Id { get; set; }
		public string? Name { get; set; }
		public int Balance { get; set; }
	}

	[Fact]
	public async Task Transaction_Commit_ShouldPersistAllChanges() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();

		// Act
		await using var txn = await storage.BeginTransactionAsync();

		var doc1 = txn.CreateChangelog<TestDoc>("doc1");
		var doc2 = txn.CreateChangelog<TestDoc>("doc2");

		await doc1.SetDocumentAsync(new TestDoc { Id = 1, Name = "Doc1", Balance = 100 });
		await doc2.SetDocumentAsync(new TestDoc { Id = 2, Name = "Doc2", Balance = 200 });

		await txn.CommitAsync();

		// Assert
		var result1 = await storage.LoadStateAsync("doc1");
		var result2 = await storage.LoadStateAsync("doc2");

		Assert.NotNull(result1);
		Assert.Equal(100, result1.Balance);
		Assert.NotNull(result2);
		Assert.Equal(200, result2.Balance);
	}

	[Fact]
	public async Task Transaction_Rollback_ShouldRevertAllChanges() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();

		// Set initial state
		await storage.SaveStateAsync("doc1", new TestDoc { Id = 1, Name = "Original1", Balance = 100 });
		await storage.SaveStateAsync("doc2", new TestDoc { Id = 2, Name = "Original2", Balance = 200 });

		// Act
		await using var txn = await storage.BeginTransactionAsync();

		var doc1 = txn.CreateChangelog<TestDoc>("doc1");
		var doc2 = txn.CreateChangelog<TestDoc>("doc2");

		// Make changes
		await doc1.ApplyChangesAsync(new TestDoc { Id = 1, Name = "Modified1", Balance = 150 });
		await doc2.ApplyChangesAsync(new TestDoc { Id = 2, Name = "Modified2", Balance = 250 });

		// Rollback
		await txn.RollbackAsync();

		// Assert - should be back to original state
		var result1 = await storage.LoadStateAsync("doc1");
		var result2 = await storage.LoadStateAsync("doc2");

		Assert.NotNull(result1);
		Assert.Equal("Original1", result1.Name);
		Assert.Equal(100, result1.Balance);

		Assert.NotNull(result2);
		Assert.Equal("Original2", result2.Name);
		Assert.Equal(200, result2.Balance);
	}

	[Fact]
	public async Task Transaction_AutoRollbackOnDispose_ShouldRevertChanges() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		await storage.SaveStateAsync("doc1", new TestDoc { Id = 1, Name = "Original", Balance = 100 });

		// Act
		await using (var txn = await storage.BeginTransactionAsync()) {
			var doc1 = txn.CreateChangelog<TestDoc>("doc1");
			await doc1.ApplyChangesAsync(new TestDoc { Id = 1, Name = "Modified", Balance = 200 });
			// No commit - will auto-rollback on dispose
		}

		// Assert
		var result = await storage.LoadStateAsync("doc1");
		Assert.NotNull(result);
		Assert.Equal("Original", result.Name);
		Assert.Equal(100, result.Balance);
	}

	[Fact]
	public async Task Transaction_AtomicTransfer_ShouldMaintainConsistency() {
		// Arrange - Simulate money transfer between accounts
		var storage = new MemoryStorage<TestDoc>();
		await storage.SaveStateAsync("accountA", new TestDoc { Id = 1, Name = "Alice", Balance = 1000 });
		await storage.SaveStateAsync("accountB", new TestDoc { Id = 2, Name = "Bob", Balance = 500 });

		// Act - Transfer $200 from Alice to Bob
		await using var txn = await storage.BeginTransactionAsync();

		var accountA = txn.CreateChangelog<TestDoc>("accountA");
		var accountB = txn.CreateChangelog<TestDoc>("accountB");

		var alice = await accountA.GetDocumentAsync();
		var bob = await accountB.GetDocumentAsync();

		alice!.Balance -= 200;  // Debit
		bob!.Balance += 200;    // Credit

		await accountA.ApplyChangesAsync(alice);
		await accountB.ApplyChangesAsync(bob);

		await txn.CommitAsync();

		// Assert
		var finalAlice = await storage.LoadStateAsync("accountA");
		var finalBob = await storage.LoadStateAsync("accountB");

		Assert.Equal(800, finalAlice!.Balance);
		Assert.Equal(700, finalBob!.Balance);
		Assert.Equal(1500, finalAlice.Balance + finalBob.Balance); // Total preserved
	}

	[Fact]
	public async Task Transaction_FailedTransfer_ShouldRollbackBoth() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		await storage.SaveStateAsync("accountA", new TestDoc { Id = 1, Name = "Alice", Balance = 1000 });
		await storage.SaveStateAsync("accountB", new TestDoc { Id = 2, Name = "Bob", Balance = 500 });

		// Act - Attempt transfer that fails midway
		try {
			await using var txn = await storage.BeginTransactionAsync();

			var accountA = txn.CreateChangelog<TestDoc>("accountA");
			var accountB = txn.CreateChangelog<TestDoc>("accountB");

			var alice = await accountA.GetDocumentAsync();
			alice!.Balance -= 200;
			await accountA.ApplyChangesAsync(alice);

			// Simulate error before crediting Bob
			throw new InvalidOperationException("Network error!");
		}
		catch (InvalidOperationException) {
			// Expected
		}

		// Assert - Both accounts should be unchanged
		var finalAlice = await storage.LoadStateAsync("accountA");
		var finalBob = await storage.LoadStateAsync("accountB");

		Assert.Equal(1000, finalAlice!.Balance); // Unchanged
		Assert.Equal(500, finalBob!.Balance);     // Unchanged
	}

	[Fact]
	public async Task Transaction_WithGroups_ShouldCommitAtomically() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();

		// Act
		await using var txn = await storage.BeginTransactionAsync();

		var doc1 = txn.CreateChangelog<TestDoc>("doc1");
		var doc2 = txn.CreateChangelog<TestDoc>("doc2");

		// Use groups within transaction
		await doc1.BeginGroupAsync(new Dictionary<string, object> { ["user"] = "test" });
		await doc1.SetDocumentAsync(new TestDoc { Id = 1, Name = "First", Balance = 100 });
		await doc1.ApplyChangesAsync(new TestDoc { Id = 1, Name = "Updated", Balance = 150 });
		await doc1.CommitGroupAsync();

		await doc2.SetDocumentAsync(new TestDoc { Id = 2, Name = "Second", Balance = 200 });

		await txn.CommitAsync();

		// Assert
		var history1 = await doc1.GetHistoryAsync();
		var result2 = await storage.LoadStateAsync("doc2");

		Assert.NotEmpty(history1);
		Assert.NotNull(result2);
		Assert.Equal(200, result2.Balance);
	}

	[Fact]
	public async Task Transaction_CommitTwice_ShouldThrow() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var txn = await storage.BeginTransactionAsync();

		// Act & Assert
		await txn.CommitAsync();
		await Assert.ThrowsAsync<InvalidOperationException>(() => txn.CommitAsync());
	}

	[Fact]
	public async Task Transaction_RollbackAfterCommit_ShouldThrow() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var txn = await storage.BeginTransactionAsync();

		// Act
		await txn.CommitAsync();

		// Assert
		await Assert.ThrowsAsync<InvalidOperationException>(() => txn.RollbackAsync());
	}
}
