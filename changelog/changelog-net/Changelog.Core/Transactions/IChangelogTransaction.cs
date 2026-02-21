using System;
using System.Threading.Tasks;

namespace Changelog;

/// <summary>
/// Represents a multi-document transaction for atomic operations across multiple changelog instances.
/// </summary>
public interface IChangelogTransaction : IAsyncDisposable {
	/// <summary>
	/// Commit all changes made within this transaction atomically.
	/// If any change fails, the entire transaction is rolled back.
	/// </summary>
	Task CommitAsync();

	/// <summary>
	/// Rollback all changes made within this transaction.
	/// Returns the storage to the state before the transaction began.
	/// </summary>
	Task RollbackAsync();

	/// <summary>
	/// Get the underlying storage instance for this transaction.
	/// Used internally by Changelog instances to participate in the transaction.
	/// </summary>
	object GetStorage();
}
