using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;

namespace Changelog.Storage;

public class SqliteStorage<T> : IChangelogStorage<T> where T : class {
	private readonly string _connectionString;

	public SqliteStorage(string connectionString) {
		_connectionString = connectionString;
		InitializeDatabase().Wait();
	}

	private async Task InitializeDatabase() {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = @"
			CREATE TABLE IF NOT EXISTS Changes (
				Id INTEGER PRIMARY KEY AUTOINCREMENT,
				DocumentId TEXT NOT NULL,
				Path TEXT NOT NULL,
				Type INTEGER NOT NULL,
				OldValue TEXT,
				NewValue TEXT,
				Timestamp INTEGER NOT NULL,
				GroupId TEXT
			);

			CREATE TABLE IF NOT EXISTS Groups (
				Id TEXT PRIMARY KEY,
				DocumentId TEXT NOT NULL,
				Timestamp INTEGER NOT NULL,
				ChangeCount INTEGER NOT NULL,
				Metadata TEXT
			);

			CREATE TABLE IF NOT EXISTS States (
				DocumentId TEXT PRIMARY KEY,
				State TEXT NOT NULL,
			LastUpdated INTEGER NOT NULL,
			Version INTEGER NOT NULL DEFAULT 1
		);

		CREATE INDEX IF NOT EXISTS idx_changes_documentid ON Changes(DocumentId);
		CREATE INDEX IF NOT EXISTS idx_changes_groupid ON Changes(GroupId);
		CREATE INDEX IF NOT EXISTS idx_groups_documentid ON Groups(DocumentId);
	-- Composite indexes for optimized query patterns
	CREATE INDEX IF NOT EXISTS idx_changes_docid_timestamp ON Changes(DocumentId, Timestamp);
	CREATE INDEX IF NOT EXISTS idx_changes_docid_groupid ON Changes(DocumentId, GroupId);
	CREATE INDEX IF NOT EXISTS idx_groups_docid_timestamp ON Groups(DocumentId, Timestamp);

	-- Add Version column to existing States table if it doesn't exist
	PRAGMA table_info(States);";
		await command.ExecuteNonQueryAsync();

		// Check if Version column exists, add it if not
		var checkCommand = connection.CreateCommand();
		checkCommand.CommandText = "PRAGMA table_info(States)";
		var hasVersion = false;
		using (var reader = await checkCommand.ExecuteReaderAsync()) {
			while (await reader.ReadAsync()) {
				if (reader.GetString(1) == "Version") {
					hasVersion = true;
					break;
				}
			}
		}

		if (!hasVersion) {
			var alterCommand = connection.CreateCommand();
			alterCommand.CommandText = "ALTER TABLE States ADD COLUMN Version INTEGER NOT NULL DEFAULT 1";
			await alterCommand.ExecuteNonQueryAsync();
		}
		await command.ExecuteNonQueryAsync();
	}

	public async Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		foreach (var change in changes) {
			var command = connection.CreateCommand();
			command.CommandText = @"
				INSERT INTO Changes (DocumentId, Path, Type, OldValue, NewValue, Timestamp, GroupId)
				VALUES (@documentId, @path, @type, @oldValue, @newValue, @timestamp, @groupId)
			";
			command.Parameters.AddWithValue("@documentId", documentId);
			command.Parameters.AddWithValue("@path", JsonSerializer.Serialize(change.Path));
			command.Parameters.AddWithValue("@type", (int)change.Type);
			command.Parameters.AddWithValue("@oldValue", change.OldValue != null ? JsonSerializer.Serialize(change.OldValue) : DBNull.Value);
			command.Parameters.AddWithValue("@newValue", change.NewValue != null ? JsonSerializer.Serialize(change.NewValue) : DBNull.Value);
			command.Parameters.AddWithValue("@timestamp", change.Timestamp);
			command.Parameters.AddWithValue("@groupId", string.IsNullOrEmpty(groupId) ? DBNull.Value : groupId);

			await command.ExecuteNonQueryAsync();
		}
	}

	public async Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		options ??= new QueryOptions();

		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		// Build SQL query with filters at database level
		var whereConditions = new List<string> { "DocumentId = @documentId" };
		var parameters = new Dictionary<string, object> { { "@documentId", documentId } };

		if (options.Since.HasValue) {
			whereConditions.Add("Timestamp >= @since");
			parameters["@since"] = options.Since.Value;
		}

		if (options.GroupId != null) {
			whereConditions.Add("GroupId = @groupId");
			parameters["@groupId"] = options.GroupId;
		}

		var sql = $@"
			SELECT Path, Type, OldValue, NewValue, Timestamp, GroupId
			FROM Changes
			WHERE {string.Join(" AND ", whereConditions)}
			ORDER BY Id";

		// Add pagination at database level
		var limit = options.Take ?? options.Limit;
		if (options.Skip.HasValue || limit.HasValue) {
			if (limit.HasValue) {
				sql += " LIMIT @limit";
				parameters["@limit"] = limit.Value;
			}
			if (options.Skip.HasValue) {
				sql += " OFFSET @offset";
				parameters["@offset"] = options.Skip.Value;
			}
		}

		var command = connection.CreateCommand();
		command.CommandText = sql;
		foreach (var param in parameters) {
			command.Parameters.AddWithValue(param.Key, param.Value);
		}

		var changes = new List<ChangeRecord>();
		using var reader = await command.ExecuteReaderAsync();
		while (await reader.ReadAsync()) {
			var path = JsonSerializer.Deserialize<string[]>(reader.GetString(0)) ?? Array.Empty<string>();
			var type = (ChangeType)reader.GetInt32(1);
			var oldValue = reader.IsDBNull(2) ? null : JsonSerializer.Deserialize<object>(reader.GetString(2));
			var newValue = reader.IsDBNull(3) ? null : JsonSerializer.Deserialize<object>(reader.GetString(3));
			var timestamp = reader.GetInt64(4);
			var groupId = reader.IsDBNull(5) ? null : reader.GetString(5);

			changes.Add(new ChangeRecord {
				Path = path,
				Type = type,
				OldValue = oldValue,
				NewValue = newValue,
				Timestamp = timestamp,
				GroupId = groupId
			});
		}

		return changes;
	}

	public async IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		options ??= new QueryOptions();

		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync(cancellationToken);

		// Build SQL query with filters at database level
		var whereConditions = new List<string> { "DocumentId = @documentId" };
		var parameters = new Dictionary<string, object> { { "@documentId", documentId } };

		if (options.Since.HasValue) {
			whereConditions.Add("Timestamp >= @since");
			parameters["@since"] = options.Since.Value;
		}

		if (options.GroupId != null) {
			whereConditions.Add("GroupId = @groupId");
			parameters["@groupId"] = options.GroupId;
		}

		var sql = $@"
			SELECT Path, Type, OldValue, NewValue, Timestamp, GroupId
			FROM Changes
			WHERE {string.Join(" AND ", whereConditions)}
			ORDER BY Id";

		// Add pagination at database level
		var limit = options.Take ?? options.Limit;
		if (options.Skip.HasValue || limit.HasValue) {
			if (limit.HasValue) {
				sql += " LIMIT @limit";
				parameters["@limit"] = limit.Value;
			}
			if (options.Skip.HasValue) {
				sql += " OFFSET @offset";
				parameters["@offset"] = options.Skip.Value;
			}
		}

		var command = connection.CreateCommand();
		command.CommandText = sql;
		foreach (var param in parameters) {
			command.Parameters.AddWithValue(param.Key, param.Value);
		}

		using var reader = await command.ExecuteReaderAsync(cancellationToken);
		while (await reader.ReadAsync(cancellationToken)) {
			cancellationToken.ThrowIfCancellationRequested();

			var path = JsonSerializer.Deserialize<string[]>(reader.GetString(0)) ?? Array.Empty<string>();
			var type = (ChangeType)reader.GetInt32(1);
			var oldValue = reader.IsDBNull(2) ? null : JsonSerializer.Deserialize<object>(reader.GetString(2));
			var newValue = reader.IsDBNull(3) ? null : JsonSerializer.Deserialize<object>(reader.GetString(3));
			var timestamp = reader.GetInt64(4);
			var groupId = reader.IsDBNull(5) ? null : reader.GetString(5);

			yield return new ChangeRecord {
				Path = path,
				Type = type,
				OldValue = oldValue,
				NewValue = newValue,
				Timestamp = timestamp,
				GroupId = groupId
			};
		}
	}

	public async Task<T?> LoadStateAsync(string documentId) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = "SELECT State FROM States WHERE DocumentId = @documentId";
		command.Parameters.AddWithValue("@documentId", documentId);

		var stateJson = await command.ExecuteScalarAsync() as string;
		return stateJson != null ? JsonSerializer.Deserialize<T>(stateJson) : null;
	}

	public async Task SaveStateAsync(string documentId, T state) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = @"
			INSERT INTO States (DocumentId, State, LastUpdated, Version)
			VALUES (@documentId, @state, @lastUpdated, 1)
			ON CONFLICT(DocumentId) DO UPDATE SET
				State = @state,
				LastUpdated = @lastUpdated,
				Version = Version + 1
		";
		command.Parameters.AddWithValue("@documentId", documentId);
		command.Parameters.AddWithValue("@state", JsonSerializer.Serialize(state));
		command.Parameters.AddWithValue("@lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

		await command.ExecuteNonQueryAsync();
	}

	public async Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = "SELECT State, Version FROM States WHERE DocumentId = @documentId";
		command.Parameters.AddWithValue("@documentId", documentId);

		using var reader = await command.ExecuteReaderAsync();
		if (await reader.ReadAsync()) {
			var stateJson = reader.GetString(0);
			var version = reader.GetInt32(1);
			var document = JsonSerializer.Deserialize<T>(stateJson);

			if (document == null)
				return null;

			return new VersionedDocument<T> {
				Document = document,
				Version = version
			};
		}

		return null;
	}

	public async Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		if (expectedVersion.HasValue) {
			// Check current version
			var checkCommand = connection.CreateCommand();
			checkCommand.CommandText = "SELECT Version FROM States WHERE DocumentId = @documentId";
			checkCommand.Parameters.AddWithValue("@documentId", documentId);
			var currentVersionObj = await checkCommand.ExecuteScalarAsync();

			if (currentVersionObj != null) {
				var currentVersion = Convert.ToInt32(currentVersionObj);
				if (currentVersion != expectedVersion.Value) {
					throw new ConcurrencyException(documentId, expectedVersion.Value, currentVersion);
				}
			}
			else if (expectedVersion.Value != 0) {
				// Document doesn't exist but expected version is not 0
				throw new ConcurrencyException(documentId, expectedVersion.Value, 0);
			}
		}

		var command = connection.CreateCommand();
		command.CommandText = @"
			INSERT INTO States (DocumentId, State, LastUpdated, Version)
			VALUES (@documentId, @state, @lastUpdated, 1)
			ON CONFLICT(DocumentId) DO UPDATE SET
				State = @state,
				LastUpdated = @lastUpdated,
				Version = Version + 1
		";
		command.Parameters.AddWithValue("@documentId", documentId);
		command.Parameters.AddWithValue("@state", JsonSerializer.Serialize(state));
		command.Parameters.AddWithValue("@lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

		await command.ExecuteNonQueryAsync();
	}

	public async Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var groupId = Guid.NewGuid().ToString();

		var command = connection.CreateCommand();
		command.CommandText = @"
			INSERT INTO Groups (Id, DocumentId, Timestamp, ChangeCount, Metadata)
			VALUES (@id, @documentId, @timestamp, 0, @metadata)
		";
		command.Parameters.AddWithValue("@id", groupId);
		command.Parameters.AddWithValue("@documentId", documentId);
		command.Parameters.AddWithValue("@timestamp", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
		command.Parameters.AddWithValue("@metadata", metadata != null ? JsonSerializer.Serialize(metadata) : DBNull.Value);

		await command.ExecuteNonQueryAsync();
		return groupId;
	}

	public async Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = @"
			SELECT Id, Timestamp, ChangeCount, Metadata
			FROM Groups
			WHERE DocumentId = @documentId
			ORDER BY Timestamp
		";
		command.Parameters.AddWithValue("@documentId", documentId);

		var groups = new List<ChangeGroup>();
		using var reader = await command.ExecuteReaderAsync();
		while (await reader.ReadAsync()) {
			groups.Add(new ChangeGroup {
				Id = reader.GetString(0),
				Timestamp = reader.GetInt64(1),
				ChangeCount = reader.GetInt32(2),
				Metadata = reader.IsDBNull(3) ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(3))
			});
		}

		return groups;
	}

	public async IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync(cancellationToken);

		var command = connection.CreateCommand();
		command.CommandText = @"
			SELECT Id, Timestamp, ChangeCount, Metadata
			FROM Groups
			WHERE DocumentId = @documentId
			ORDER BY Timestamp
		";
		command.Parameters.AddWithValue("@documentId", documentId);

		using var reader = await command.ExecuteReaderAsync(cancellationToken);
		while (await reader.ReadAsync(cancellationToken)) {
			cancellationToken.ThrowIfCancellationRequested();

			yield return new ChangeGroup {
				Id = reader.GetString(0),
				Timestamp = reader.GetInt64(1),
				ChangeCount = reader.GetInt32(2),
				Metadata = reader.IsDBNull(3) ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(3))
			};
		}
	}

	public async Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var command = connection.CreateCommand();
		command.CommandText = @"
			UPDATE Groups
			SET ChangeCount = @count
			WHERE DocumentId = @documentId AND Id = @groupId
		";
		command.Parameters.AddWithValue("@count", count);
		command.Parameters.AddWithValue("@documentId", documentId);
		command.Parameters.AddWithValue("@groupId", groupId);

		await command.ExecuteNonQueryAsync();
	}

	public async Task TrimHistoryAsync(string documentId, int maxGroups) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		// Get count of groups
		var countCommand = connection.CreateCommand();
		countCommand.CommandText = "SELECT COUNT(*) FROM Groups WHERE DocumentId = @documentId";
		countCommand.Parameters.AddWithValue("@documentId", documentId);
		var groupCount = Convert.ToInt32(await countCommand.ExecuteScalarAsync());

		if (groupCount <= maxGroups) return;

		var groupsToDelete = groupCount - maxGroups;

		// Get IDs of oldest groups to delete
		var selectCommand = connection.CreateCommand();
		selectCommand.CommandText = @"
			SELECT Id FROM Groups
			WHERE DocumentId = @documentId
			ORDER BY Timestamp
			LIMIT @count
		";
		selectCommand.Parameters.AddWithValue("@documentId", documentId);
		selectCommand.Parameters.AddWithValue("@count", groupsToDelete);

		var groupIds = new List<string>();
		using var reader = await selectCommand.ExecuteReaderAsync();
		while (await reader.ReadAsync()) {
			groupIds.Add(reader.GetString(0));
		}

		if (groupIds.Count == 0) return;

		// Delete changes in these groups
		var deleteChangesCommand = connection.CreateCommand();
		var placeholders = string.Join(",", groupIds.Select((_, i) => $"@groupId{i}"));
		deleteChangesCommand.CommandText = $@"
			DELETE FROM Changes
			WHERE DocumentId = @documentId AND GroupId IN ({placeholders})
		";
		deleteChangesCommand.Parameters.AddWithValue("@documentId", documentId);
		for (int i = 0; i < groupIds.Count; i++) {
			deleteChangesCommand.Parameters.AddWithValue($"@groupId{i}", groupIds[i]);
		}
		await deleteChangesCommand.ExecuteNonQueryAsync();

		// Delete the groups
		var deleteGroupsCommand = connection.CreateCommand();
		deleteGroupsCommand.CommandText = $@"
			DELETE FROM Groups
			WHERE Id IN ({placeholders})
		";
		for (int i = 0; i < groupIds.Count; i++) {
			deleteGroupsCommand.Parameters.AddWithValue($"@groupId{i}", groupIds[i]);
		}
		await deleteGroupsCommand.ExecuteNonQueryAsync();
	}

	public async Task ClearAsync(string documentId) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var transaction = await connection.BeginTransactionAsync();
		try {
			var deleteChanges = connection.CreateCommand();
			deleteChanges.CommandText = "DELETE FROM Changes WHERE DocumentId = @documentId";
			deleteChanges.Parameters.AddWithValue("@documentId", documentId);
			await deleteChanges.ExecuteNonQueryAsync();

			var deleteGroups = connection.CreateCommand();
			deleteGroups.CommandText = "DELETE FROM Groups WHERE DocumentId = @documentId";
			deleteGroups.Parameters.AddWithValue("@documentId", documentId);
			await deleteGroups.ExecuteNonQueryAsync();

			var deleteState = connection.CreateCommand();
			deleteState.CommandText = "DELETE FROM States WHERE DocumentId = @documentId";
			deleteState.Parameters.AddWithValue("@documentId", documentId);
			await deleteState.ExecuteNonQueryAsync();

			await transaction.CommitAsync();
		}
		catch {
			await transaction.RollbackAsync();
			throw;
		}
	}

	public async Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		using var connection = new SqliteConnection(_connectionString);
		await connection.OpenAsync();

		var transaction = await connection.BeginTransactionAsync();
		try {
			// 1. Append changes
			if (changes.Count > 0) {
				foreach (var change in changes) {
					var command = connection.CreateCommand();
					command.Transaction = (Microsoft.Data.Sqlite.SqliteTransaction)transaction;
					command.CommandText = @"
						INSERT INTO Changes (DocumentId, Path, Type, OldValue, NewValue, Timestamp, GroupId)
						VALUES (@documentId, @path, @type, @oldValue, @newValue, @timestamp, @groupId)
					";
					command.Parameters.AddWithValue("@documentId", documentId);
					command.Parameters.AddWithValue("@path", JsonSerializer.Serialize(change.Path));
					command.Parameters.AddWithValue("@type", (int)change.Type);
					command.Parameters.AddWithValue("@oldValue", change.OldValue != null ? JsonSerializer.Serialize(change.OldValue) : DBNull.Value);
					command.Parameters.AddWithValue("@newValue", change.NewValue != null ? JsonSerializer.Serialize(change.NewValue) : DBNull.Value);
					command.Parameters.AddWithValue("@timestamp", change.Timestamp);
					command.Parameters.AddWithValue("@groupId", string.IsNullOrEmpty(groupId) ? DBNull.Value : groupId);

					await command.ExecuteNonQueryAsync();
				}

				// 2. Update group change count
				var updateCommand = connection.CreateCommand();
				updateCommand.Transaction = (Microsoft.Data.Sqlite.SqliteTransaction)transaction;
				updateCommand.CommandText = @"
					UPDATE Groups
					SET ChangeCount = @count
					WHERE DocumentId = @documentId AND Id = @groupId
				";
				updateCommand.Parameters.AddWithValue("@count", changes.Count);
				updateCommand.Parameters.AddWithValue("@documentId", documentId);
				updateCommand.Parameters.AddWithValue("@groupId", groupId);
				await updateCommand.ExecuteNonQueryAsync();

				// 3. Save state if provided
				if (state != null) {
					var saveStateCommand = connection.CreateCommand();
					saveStateCommand.Transaction = (Microsoft.Data.Sqlite.SqliteTransaction)transaction;
					saveStateCommand.CommandText = @"
					INSERT INTO States (DocumentId, State, LastUpdated, Version)
					VALUES (@documentId, @state, @lastUpdated, 1)
					ON CONFLICT(DocumentId) DO UPDATE SET
						State = @state,
						LastUpdated = @lastUpdated,
						Version = Version + 1
					";
					saveStateCommand.Parameters.AddWithValue("@documentId", documentId);
					saveStateCommand.Parameters.AddWithValue("@state", JsonSerializer.Serialize(state));
					saveStateCommand.Parameters.AddWithValue("@lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
					await saveStateCommand.ExecuteNonQueryAsync();
				}
			}

			await transaction.CommitAsync();
		}
		catch {
			await transaction.RollbackAsync();
			throw;
		}
	}
}
