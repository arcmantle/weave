using System;
using Changelog.Storage;
using Microsoft.Extensions.Logging;

namespace Changelog;

/// <summary>
/// Extension methods for working with transactions
/// </summary>
public static class TransactionExtensions {
	/// <summary>
	/// Create a Changelog instance that participates in this transaction.
	/// For MemoryStorage, returns the storage from transaction context.
	/// For SqliteStorage, requires changelogs to be created before transaction begins.
	/// </summary>
	/// <typeparam name="T">Document type</typeparam>
	/// <param name="transaction">The transaction</param>
	/// <param name="documentId">Document identifier</param>
	/// <param name="logger">Optional logger</param>
	/// <returns>Changelog instance bound to this transaction</returns>
	public static Changelog<T> CreateChangelog<T>(
		this IChangelogTransaction transaction,
		string documentId,
		ILogger<Changelog<T>>? logger = null
	) where T : class {
		var storage = transaction.GetStorage();

		if (storage is not IChangelogStorage<T> typedStorage) {
			throw new InvalidOperationException(
				$"Transaction storage is not compatible with document type {typeof(T).Name}");
		}

		return new Changelog<T>(typedStorage, documentId, logger);
	}
}
