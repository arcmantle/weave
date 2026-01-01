using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
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
				LastUpdated INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_changes_documentid ON Changes(DocumentId);
			CREATE INDEX IF NOT EXISTS idx_changes_groupid ON Changes(GroupId);
			CREATE INDEX IF NOT EXISTS idx_groups_documentid ON Groups(DocumentId);
		";
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

		var command = connection.CreateCommand();
		command.CommandText = @"
			SELECT Path, Type, OldValue, NewValue, Timestamp, GroupId
			FROM Changes
			WHERE DocumentId = @documentId
			ORDER BY Id
		";
		command.Parameters.AddWithValue("@documentId", documentId);

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

		// Apply filters
		if (options.Since.HasValue)
			changes = changes.Where(c => c.Timestamp >= options.Since.Value).ToList();
		if (options.GroupId != null)
			changes = changes.Where(c => c.GroupId == options.GroupId).ToList();
		if (options.Limit.HasValue)
			changes = changes.Take(options.Limit.Value).ToList();

		return changes;
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
			INSERT INTO States (DocumentId, State, LastUpdated)
			VALUES (@documentId, @state, @lastUpdated)
			ON CONFLICT(DocumentId) DO UPDATE SET
				State = @state,
				LastUpdated = @lastUpdated
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
}
