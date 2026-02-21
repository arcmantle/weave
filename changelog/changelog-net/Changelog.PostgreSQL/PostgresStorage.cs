using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Npgsql;
using NpgsqlTypes;

namespace Changelog.Storage;

public sealed class PostgresStorage<T> : IChangelogStorage<T> where T : class {
	private readonly string _connectionString;
	private readonly NpgsqlConnection? _connection;
	private readonly NpgsqlTransaction? _transaction;

	private readonly string _schema;
	private readonly string _changesTable;
	private readonly string _groupsTable;
	private readonly string _statesTable;

	private readonly string _changesTableQualifiedSql;
	private readonly string _groupsTableQualifiedSql;
	private readonly string _statesTableQualifiedSql;

	public PostgresStorage(string connectionString, PostgresStorageOptions? options = null) {
		_connectionString = connectionString;

		options ??= new PostgresStorageOptions();
		_schema = ResolveSchema(options.Schema);

		var prefix = NormalizePrefix(options.TablePrefix);
		_changesTable = ResolveIdentifier(options.ChangesTable, baseName: "Changes", prefix, nameof(PostgresStorageOptions.ChangesTable));
		_groupsTable = ResolveIdentifier(options.GroupsTable, baseName: "Groups", prefix, nameof(PostgresStorageOptions.GroupsTable));
		_statesTable = ResolveIdentifier(options.StatesTable, baseName: "States", prefix, nameof(PostgresStorageOptions.StatesTable));

		_changesTableQualifiedSql = Qualify(_schema, _changesTable);
		_groupsTableQualifiedSql = Qualify(_schema, _groupsTable);
		_statesTableQualifiedSql = Qualify(_schema, _statesTable);

		InitializeDatabase().GetAwaiter().GetResult();
	}

	private PostgresStorage(
		NpgsqlConnection connection,
		NpgsqlTransaction transaction,
		string connectionString,
		string schema,
		string changesTable,
		string groupsTable,
		string statesTable
	) {
		_connectionString = connectionString;
		_connection = connection;
		_transaction = transaction;
		_schema = schema;
		_changesTable = changesTable;
		_groupsTable = groupsTable;
		_statesTable = statesTable;

		_changesTableQualifiedSql = Qualify(_schema, _changesTable);
		_groupsTableQualifiedSql = Qualify(_schema, _groupsTable);
		_statesTableQualifiedSql = Qualify(_schema, _statesTable);
	}

	private async Task InitializeDatabase() {
		await using var connection = new NpgsqlConnection(_connectionString);
		await connection.OpenAsync();

		await using var cmd = connection.CreateCommand();
		cmd.CommandText = $@"
			CREATE SCHEMA IF NOT EXISTS {QuoteIdentifier(_schema)};

			CREATE TABLE IF NOT EXISTS {_changesTableQualifiedSql} (
				Id BIGSERIAL PRIMARY KEY,
				DocumentId TEXT NOT NULL,
				Path JSONB NOT NULL,
				Type INTEGER NOT NULL,
				OldValue JSONB NULL,
				NewValue JSONB NULL,
				Timestamp BIGINT NOT NULL,
				GroupId TEXT NULL
			);

			CREATE TABLE IF NOT EXISTS {_groupsTableQualifiedSql} (
				Id TEXT PRIMARY KEY,
				DocumentId TEXT NOT NULL,
				Timestamp BIGINT NOT NULL,
				ChangeCount INTEGER NOT NULL,
				Metadata JSONB NULL
			);

			CREATE TABLE IF NOT EXISTS {_statesTableQualifiedSql} (
				DocumentId TEXT PRIMARY KEY,
				State JSONB NOT NULL,
				LastUpdated BIGINT NOT NULL,
				Version INTEGER NOT NULL DEFAULT 1
			);

			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_changesTable, "documentid"))} ON {_changesTableQualifiedSql}(DocumentId);
			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_changesTable, "groupid"))} ON {_changesTableQualifiedSql}(GroupId);
			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_groupsTable, "documentid"))} ON {_groupsTableQualifiedSql}(DocumentId);
			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_changesTable, "docid_timestamp"))} ON {_changesTableQualifiedSql}(DocumentId, Timestamp);
			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_changesTable, "docid_groupid"))} ON {_changesTableQualifiedSql}(DocumentId, GroupId);
			CREATE INDEX IF NOT EXISTS {QuoteIdentifier(IndexName(_groupsTable, "docid_timestamp"))} ON {_groupsTableQualifiedSql}(DocumentId, Timestamp);
		";

		await cmd.ExecuteNonQueryAsync();
	}

	private static string QuoteIdentifier(string identifier) {
		return $"\"{identifier.Replace("\"", "\"\"")}\"";
	}

	private static string Qualify(string schema, string table) {
		return $"{QuoteIdentifier(schema)}.{QuoteIdentifier(table)}";
	}

	private static string IndexName(string table, string suffix) => $"idx_{table}_{suffix}";

	private static string ResolveSchema(string? schema) {
		schema = (schema ?? "public").Trim();
		if (schema.Length == 0)
			schema = "public";

		ValidateIdentifier(schema, nameof(PostgresStorageOptions.Schema));
		return schema;
	}

	private static string? NormalizePrefix(string? prefix) {
		if (prefix == null)
			return null;

		prefix = prefix.Trim();
		if (prefix.Length == 0)
			return null;

		ValidateIdentifier(prefix, nameof(PostgresStorageOptions.TablePrefix));
		return prefix;
	}

	private static string ResolveIdentifier(string? explicitValue, string baseName, string? prefix, string parameterName) {
		var resolved = explicitValue?.Trim();
		if (string.IsNullOrEmpty(resolved))
			resolved = prefix != null ? prefix + baseName : baseName;

		ValidateIdentifier(resolved, parameterName);
		return resolved;
	}

	private static void ValidateIdentifier(string identifier, string parameterName) {
		if (string.IsNullOrWhiteSpace(identifier))
			throw new ArgumentException("Identifier must not be empty.", parameterName);

		for (var i = 0; i < identifier.Length; i++) {
			var c = identifier[i];
			var isLetter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
			var isDigit = c >= '0' && c <= '9';
			var isUnderscore = c == '_';

			if (!isLetter && !isDigit && !isUnderscore)
				throw new ArgumentException(
					"Identifiers may only contain letters, digits, and underscore (_).",
					parameterName
				);

			if (i == 0 && isDigit)
				throw new ArgumentException("Identifiers must not start with a digit.", parameterName);
		}
	}

	private async Task<(NpgsqlConnection Connection, bool Owned)> OpenConnectionAsync(CancellationToken cancellationToken = default) {
		if (_connection != null)
			return (_connection, false);

		var conn = new NpgsqlConnection(_connectionString);
		await conn.OpenAsync(cancellationToken);
		return (conn, true);
	}

	private NpgsqlCommand CreateCommand(NpgsqlConnection connection) {
		var cmd = connection.CreateCommand();
		if (_transaction != null)
			cmd.Transaction = _transaction;
		return cmd;
	}

	public async Task<T?> LoadStateAsync(string documentId) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $"SELECT State FROM {_statesTableQualifiedSql} WHERE DocumentId = @documentId";
			cmd.Parameters.AddWithValue("documentId", documentId);

			var stateJson = await cmd.ExecuteScalarAsync() as string;
			return stateJson != null ? JsonSerializer.Deserialize<T>(stateJson) : null;
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task SaveStateAsync(string documentId, T state) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				INSERT INTO {_statesTableQualifiedSql} (DocumentId, State, LastUpdated, Version)
				VALUES (@documentId, @state::jsonb, @lastUpdated, 1)
				ON CONFLICT (DocumentId) DO UPDATE SET
					State = EXCLUDED.State,
					LastUpdated = EXCLUDED.LastUpdated,
					Version = {_statesTableQualifiedSql}.Version + 1
			";
			cmd.Parameters.AddWithValue("documentId", documentId);
			cmd.Parameters.Add("state", NpgsqlDbType.Text).Value = JsonSerializer.Serialize(state);
			cmd.Parameters.AddWithValue("lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

			await cmd.ExecuteNonQueryAsync();
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $"SELECT State, Version FROM {_statesTableQualifiedSql} WHERE DocumentId = @documentId";
			cmd.Parameters.AddWithValue("documentId", documentId);

			await using var reader = await cmd.ExecuteReaderAsync();
			if (!await reader.ReadAsync())
				return null;

			var stateJson = reader.GetString(0);
			var version = reader.GetInt32(1);
			var document = JsonSerializer.Deserialize<T>(stateJson);
			if (document == null)
				return null;

			return new VersionedDocument<T> { Document = document, Version = version };
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		if (expectedVersion == null) {
			await SaveStateAsync(documentId, state);
			return;
		}

		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				INSERT INTO {_statesTableQualifiedSql} (DocumentId, State, LastUpdated, Version)
				VALUES (@documentId, @state::jsonb, @lastUpdated, 1)
				ON CONFLICT (DocumentId) DO UPDATE SET
					State = EXCLUDED.State,
					LastUpdated = EXCLUDED.LastUpdated,
					Version = {_statesTableQualifiedSql}.Version + 1
				WHERE {_statesTableQualifiedSql}.Version = @expectedVersion
			";
			cmd.Parameters.AddWithValue("documentId", documentId);
			cmd.Parameters.Add("state", NpgsqlDbType.Text).Value = JsonSerializer.Serialize(state);
			cmd.Parameters.AddWithValue("lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
			cmd.Parameters.AddWithValue("expectedVersion", expectedVersion.Value);

			var affected = await cmd.ExecuteNonQueryAsync();
			if (affected > 0)
				return;

			await using var check = CreateCommand(connection);
			check.CommandText = $"SELECT Version FROM {_statesTableQualifiedSql} WHERE DocumentId = @documentId";
			check.Parameters.AddWithValue("documentId", documentId);
			var currentObj = await check.ExecuteScalarAsync();
			var current = currentObj == null || currentObj is DBNull ? 0 : Convert.ToInt32(currentObj);
			throw new ConcurrencyException(documentId, expectedVersion.Value, current);
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			foreach (var change in changes) {
				await using var cmd = CreateCommand(connection);
				cmd.CommandText = $@"
					INSERT INTO {_changesTableQualifiedSql} (DocumentId, Path, Type, OldValue, NewValue, Timestamp, GroupId)
					VALUES (@documentId, @path::jsonb, @type, @oldValue::jsonb, @newValue::jsonb, @timestamp, @groupId)
				";
				cmd.Parameters.AddWithValue("documentId", documentId);
				cmd.Parameters.Add("path", NpgsqlDbType.Text).Value = JsonSerializer.Serialize(change.Path);
				cmd.Parameters.AddWithValue("type", (int)change.Type);
				cmd.Parameters.Add("oldValue", NpgsqlDbType.Text).Value = change.OldValue != null ? JsonSerializer.Serialize(change.OldValue) : (object)DBNull.Value;
				cmd.Parameters.Add("newValue", NpgsqlDbType.Text).Value = change.NewValue != null ? JsonSerializer.Serialize(change.NewValue) : (object)DBNull.Value;
				cmd.Parameters.AddWithValue("timestamp", change.Timestamp);
				cmd.Parameters.AddWithValue("groupId", string.IsNullOrEmpty(groupId) ? DBNull.Value : groupId);

				await cmd.ExecuteNonQueryAsync();
			}
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		options ??= new QueryOptions();

		var (connection, owned) = await OpenConnectionAsync();
		try {
			var whereConditions = new List<string> { "DocumentId = @documentId" };
			var parameters = new Dictionary<string, object> { { "documentId", documentId } };

			if (options.Since.HasValue) {
				whereConditions.Add("Timestamp >= @since");
				parameters["since"] = options.Since.Value;
			}

			if (options.GroupId != null) {
				whereConditions.Add("GroupId = @groupId");
				parameters["groupId"] = options.GroupId;
			}

			var sql = $@"
				SELECT Path::text, Type, OldValue::text, NewValue::text, Timestamp, GroupId
				FROM {_changesTableQualifiedSql}
				WHERE {string.Join(" AND ", whereConditions)}
				ORDER BY Id";

			var limit = options.Take ?? options.Limit;
			if (options.Skip.HasValue || limit.HasValue) {
				if (limit.HasValue) {
					sql += " LIMIT @limit";
					parameters["limit"] = limit.Value;
				}
				if (options.Skip.HasValue) {
					sql += " OFFSET @offset";
					parameters["offset"] = options.Skip.Value;
				}
			}

			await using var cmd = CreateCommand(connection);
			cmd.CommandText = sql;
			foreach (var kv in parameters) {
				cmd.Parameters.AddWithValue(kv.Key, kv.Value);
			}

			var changes = new List<ChangeRecord>();
			await using var reader = await cmd.ExecuteReaderAsync();
			while (await reader.ReadAsync()) {
				var pathJson = reader.GetString(0);
				var path = JsonSerializer.Deserialize<string[]>(pathJson) ?? Array.Empty<string>();
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
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		options ??= new QueryOptions();

		var (connection, owned) = await OpenConnectionAsync(cancellationToken);
		try {
			var whereConditions = new List<string> { "DocumentId = @documentId" };
			var parameters = new Dictionary<string, object> { { "documentId", documentId } };

			if (options.Since.HasValue) {
				whereConditions.Add("Timestamp >= @since");
				parameters["since"] = options.Since.Value;
			}

			if (options.GroupId != null) {
				whereConditions.Add("GroupId = @groupId");
				parameters["groupId"] = options.GroupId;
			}

			var sql = $@"
				SELECT Path::text, Type, OldValue::text, NewValue::text, Timestamp, GroupId
				FROM {_changesTableQualifiedSql}
				WHERE {string.Join(" AND ", whereConditions)}
				ORDER BY Id";

			var limit = options.Take ?? options.Limit;
			if (options.Skip.HasValue || limit.HasValue) {
				if (limit.HasValue) {
					sql += " LIMIT @limit";
					parameters["limit"] = limit.Value;
				}
				if (options.Skip.HasValue) {
					sql += " OFFSET @offset";
					parameters["offset"] = options.Skip.Value;
				}
			}

			await using var cmd = CreateCommand(connection);
			cmd.CommandText = sql;
			foreach (var kv in parameters) {
				cmd.Parameters.AddWithValue(kv.Key, kv.Value);
			}

			await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
			while (await reader.ReadAsync(cancellationToken)) {
				cancellationToken.ThrowIfCancellationRequested();

				var pathJson = reader.GetString(0);
				var path = JsonSerializer.Deserialize<string[]>(pathJson) ?? Array.Empty<string>();
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
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		var groupId = Guid.NewGuid().ToString();

		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				INSERT INTO {_groupsTableQualifiedSql} (Id, DocumentId, Timestamp, ChangeCount, Metadata)
				VALUES (@id, @documentId, @timestamp, 0, @metadata::jsonb)
			";
			cmd.Parameters.AddWithValue("id", groupId);
			cmd.Parameters.AddWithValue("documentId", documentId);
			cmd.Parameters.AddWithValue("timestamp", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
			cmd.Parameters.Add("metadata", NpgsqlDbType.Text).Value = metadata != null ? JsonSerializer.Serialize(metadata) : (object)DBNull.Value;

			await cmd.ExecuteNonQueryAsync();
			return groupId;
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				SELECT Id, Timestamp, ChangeCount, Metadata::text
				FROM {_groupsTableQualifiedSql}
				WHERE DocumentId = @documentId
				ORDER BY Timestamp
			";
			cmd.Parameters.AddWithValue("documentId", documentId);

			var groups = new List<ChangeGroup>();
			await using var reader = await cmd.ExecuteReaderAsync();
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
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		var (connection, owned) = await OpenConnectionAsync(cancellationToken);
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				SELECT Id, Timestamp, ChangeCount, Metadata::text
				FROM {_groupsTableQualifiedSql}
				WHERE DocumentId = @documentId
				ORDER BY Timestamp
			";
			cmd.Parameters.AddWithValue("documentId", documentId);

			await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
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
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var cmd = CreateCommand(connection);
			cmd.CommandText = $@"
				UPDATE {_groupsTableQualifiedSql}
				SET ChangeCount = @count
				WHERE DocumentId = @documentId AND Id = @groupId
			";
			cmd.Parameters.AddWithValue("count", count);
			cmd.Parameters.AddWithValue("documentId", documentId);
			cmd.Parameters.AddWithValue("groupId", groupId);
			await cmd.ExecuteNonQueryAsync();
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task TrimHistoryAsync(string documentId, int maxGroups) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			await using var countCmd = CreateCommand(connection);
			countCmd.CommandText = $"SELECT COUNT(*) FROM {_groupsTableQualifiedSql} WHERE DocumentId = @documentId";
			countCmd.Parameters.AddWithValue("documentId", documentId);
			var groupCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync());
			if (groupCount <= maxGroups)
				return;

			var groupsToDelete = groupCount - maxGroups;
			await using var selectCmd = CreateCommand(connection);
			selectCmd.CommandText = $@"
				SELECT Id
				FROM {_groupsTableQualifiedSql}
				WHERE DocumentId = @documentId
				ORDER BY Timestamp
				LIMIT @count
			";
			selectCmd.Parameters.AddWithValue("documentId", documentId);
			selectCmd.Parameters.AddWithValue("count", groupsToDelete);

			var groupIds = new List<string>();
			await using (var reader = await selectCmd.ExecuteReaderAsync()) {
				while (await reader.ReadAsync()) {
					groupIds.Add(reader.GetString(0));
				}
			}
			if (groupIds.Count == 0)
				return;

			await using var deleteChangesCmd = CreateCommand(connection);
			deleteChangesCmd.CommandText = $@"
				DELETE FROM {_changesTableQualifiedSql}
				WHERE DocumentId = @documentId AND GroupId = ANY(@groupIds)
			";
			deleteChangesCmd.Parameters.AddWithValue("documentId", documentId);
			deleteChangesCmd.Parameters.Add("groupIds", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = groupIds.ToArray();
			await deleteChangesCmd.ExecuteNonQueryAsync();

			await using var deleteGroupsCmd = CreateCommand(connection);
			deleteGroupsCmd.CommandText = $@"
				DELETE FROM {_groupsTableQualifiedSql}
				WHERE Id = ANY(@groupIds)
			";
			deleteGroupsCmd.Parameters.Add("groupIds", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = groupIds.ToArray();
			await deleteGroupsCmd.ExecuteNonQueryAsync();
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	public async Task ClearAsync(string documentId) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			if (_transaction == null) {
				await using var tx = await connection.BeginTransactionAsync();
				await ClearAsyncInternal(connection, tx, documentId);
				await tx.CommitAsync();
				return;
			}

			await ClearAsyncInternal(connection, _transaction, documentId);
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	private async Task ClearAsyncInternal(NpgsqlConnection connection, NpgsqlTransaction transaction, string documentId) {
		await using var deleteChanges = connection.CreateCommand();
		deleteChanges.Transaction = transaction;
		deleteChanges.CommandText = $"DELETE FROM {_changesTableQualifiedSql} WHERE DocumentId = @documentId";
		deleteChanges.Parameters.AddWithValue("documentId", documentId);
		await deleteChanges.ExecuteNonQueryAsync();

		await using var deleteGroups = connection.CreateCommand();
		deleteGroups.Transaction = transaction;
		deleteGroups.CommandText = $"DELETE FROM {_groupsTableQualifiedSql} WHERE DocumentId = @documentId";
		deleteGroups.Parameters.AddWithValue("documentId", documentId);
		await deleteGroups.ExecuteNonQueryAsync();

		await using var deleteState = connection.CreateCommand();
		deleteState.Transaction = transaction;
		deleteState.CommandText = $"DELETE FROM {_statesTableQualifiedSql} WHERE DocumentId = @documentId";
		deleteState.Parameters.AddWithValue("documentId", documentId);
		await deleteState.ExecuteNonQueryAsync();
	}

	public async Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		var (connection, owned) = await OpenConnectionAsync();
		try {
			if (_transaction == null) {
				await using var tx = await connection.BeginTransactionAsync();
				await CommitGroupInternal(connection, tx, documentId, groupId, changes, state);
				await tx.CommitAsync();
				return;
			}

			await CommitGroupInternal(connection, _transaction, documentId, groupId, changes, state);
		}
		finally {
			if (owned)
				await connection.DisposeAsync();
		}
	}

	private async Task CommitGroupInternal(
		NpgsqlConnection connection,
		NpgsqlTransaction transaction,
		string documentId,
		string groupId,
		List<ChangeRecord> changes,
		T? state
	) {
		if (changes.Count > 0) {
			foreach (var change in changes) {
				await using var cmd = connection.CreateCommand();
				cmd.Transaction = transaction;
				cmd.CommandText = $@"
					INSERT INTO {_changesTableQualifiedSql} (DocumentId, Path, Type, OldValue, NewValue, Timestamp, GroupId)
					VALUES (@documentId, @path::jsonb, @type, @oldValue::jsonb, @newValue::jsonb, @timestamp, @groupId)
				";
				cmd.Parameters.AddWithValue("documentId", documentId);
				cmd.Parameters.Add("path", NpgsqlDbType.Text).Value = JsonSerializer.Serialize(change.Path);
				cmd.Parameters.AddWithValue("type", (int)change.Type);
				cmd.Parameters.Add("oldValue", NpgsqlDbType.Text).Value = change.OldValue != null ? JsonSerializer.Serialize(change.OldValue) : (object)DBNull.Value;
				cmd.Parameters.Add("newValue", NpgsqlDbType.Text).Value = change.NewValue != null ? JsonSerializer.Serialize(change.NewValue) : (object)DBNull.Value;
				cmd.Parameters.AddWithValue("timestamp", change.Timestamp);
				cmd.Parameters.AddWithValue("groupId", string.IsNullOrEmpty(groupId) ? DBNull.Value : groupId);
				await cmd.ExecuteNonQueryAsync();
			}

			await using var updateGroup = connection.CreateCommand();
			updateGroup.Transaction = transaction;
			updateGroup.CommandText = $@"
				UPDATE {_groupsTableQualifiedSql}
				SET ChangeCount = @count
				WHERE DocumentId = @documentId AND Id = @groupId
			";
			updateGroup.Parameters.AddWithValue("count", changes.Count);
			updateGroup.Parameters.AddWithValue("documentId", documentId);
			updateGroup.Parameters.AddWithValue("groupId", groupId);
			await updateGroup.ExecuteNonQueryAsync();

			if (state != null) {
				await using var saveState = connection.CreateCommand();
				saveState.Transaction = transaction;
				saveState.CommandText = $@"
					INSERT INTO {_statesTableQualifiedSql} (DocumentId, State, LastUpdated, Version)
					VALUES (@documentId, @state::jsonb, @lastUpdated, 1)
					ON CONFLICT (DocumentId) DO UPDATE SET
						State = EXCLUDED.State,
						LastUpdated = EXCLUDED.LastUpdated,
						Version = {_statesTableQualifiedSql}.Version + 1
				";
				saveState.Parameters.AddWithValue("documentId", documentId);
				saveState.Parameters.Add("state", NpgsqlDbType.Text).Value = JsonSerializer.Serialize(state);
				saveState.Parameters.AddWithValue("lastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
				await saveState.ExecuteNonQueryAsync();
			}
		}
	}

	public async Task<IChangelogTransaction> BeginTransactionAsync() {
		var connection = new NpgsqlConnection(_connectionString);
		await connection.OpenAsync();
		var transaction = await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

		var transactionalStorage = new PostgresStorage<T>(
			connection,
			transaction,
			_connectionString,
			_schema,
			_changesTable,
			_groupsTable,
			_statesTable
		);

		return new PostgresTransaction(transactionalStorage, connection, transaction);
	}

	public async Task<HealthCheckResult> CheckHealthAsync() {
		var stopwatch = Stopwatch.StartNew();

		try {
			await using var connection = new NpgsqlConnection(_connectionString);
			await connection.OpenAsync();

			await using var cmd = connection.CreateCommand();
			cmd.CommandText = "SELECT 1";
			_ = await cmd.ExecuteScalarAsync();

			await using var tableCmd = connection.CreateCommand();
			tableCmd.CommandText = @"
				SELECT COUNT(*)
				FROM information_schema.tables
				WHERE table_schema = @schema AND table_name = ANY(@tables)
			";
			tableCmd.Parameters.AddWithValue("schema", _schema);
			tableCmd.Parameters.Add("tables", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = new[] {
				_changesTable.ToLowerInvariant(),
				_groupsTable.ToLowerInvariant(),
				_statesTable.ToLowerInvariant()
			};

			var tableCount = Convert.ToInt64(await tableCmd.ExecuteScalarAsync());

			stopwatch.Stop();

			var status = stopwatch.ElapsedMilliseconds > 250
				? HealthStatus.Degraded
				: HealthStatus.Healthy;

			return new HealthCheckResult {
				Status = status,
				Description = status == HealthStatus.Healthy ? "Storage is healthy" : "Storage is operational but slow",
				Duration = stopwatch.Elapsed,
				Data = new Dictionary<string, object> {
					["latencyMs"] = stopwatch.ElapsedMilliseconds,
					["tableCount"] = tableCount
				}
			};
		}
		catch (Exception ex) {
			stopwatch.Stop();
			return new HealthCheckResult {
				Status = HealthStatus.Unhealthy,
				Description = $"Health check failed: {ex.Message}",
				Exception = ex,
				Duration = stopwatch.Elapsed,
				Data = new Dictionary<string, object> { ["latencyMs"] = stopwatch.ElapsedMilliseconds }
			};
		}
	}

	private sealed class PostgresTransaction : IChangelogTransaction {
		private readonly IChangelogStorage<T> _storage;
		private readonly NpgsqlConnection _connection;
		private readonly NpgsqlTransaction _transaction;
		private bool _committed;
		private bool _rolledBack;

		public PostgresTransaction(IChangelogStorage<T> storage, NpgsqlConnection connection, NpgsqlTransaction transaction) {
			_storage = storage;
			_connection = connection;
			_transaction = transaction;
		}

		public async Task CommitAsync() {
			if (_committed)
				throw new InvalidOperationException("Transaction already committed");
			if (_rolledBack)
				throw new InvalidOperationException("Transaction already rolled back");

			await _transaction.CommitAsync();
			_committed = true;
		}

		public async Task RollbackAsync() {
			if (_committed)
				throw new InvalidOperationException("Cannot rollback committed transaction");
			if (_rolledBack)
				return;

			await _transaction.RollbackAsync();
			_rolledBack = true;
		}

		public async ValueTask DisposeAsync() {
			if (!_committed && !_rolledBack) {
				await RollbackAsync();
			}

			await _transaction.DisposeAsync();
			await _connection.DisposeAsync();
		}

		object IChangelogTransaction.GetStorage() => _storage;
	}
}
