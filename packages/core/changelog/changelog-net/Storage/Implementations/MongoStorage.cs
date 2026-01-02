using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Changelog.Storage;

public sealed class MongoStorage<T> : IChangelogStorage<T> where T : class {
	private readonly IMongoClient _client;
	private readonly IMongoDatabase _db;
	private readonly IClientSessionHandle? _session;

	private readonly string _changesCollectionName;
	private readonly string _groupsCollectionName;
	private readonly string _statesCollectionName;

	private IMongoCollection<BsonDocument> Changes => _db.GetCollection<BsonDocument>(_changesCollectionName);
	private IMongoCollection<BsonDocument> Groups => _db.GetCollection<BsonDocument>(_groupsCollectionName);
	private IMongoCollection<BsonDocument> States => _db.GetCollection<BsonDocument>(_statesCollectionName);

	public MongoStorage(string connectionString, MongoStorageOptions? options = null) {
		options ??= new MongoStorageOptions();

		var mongoUrl = MongoUrl.Create(connectionString);
		_client = new MongoClient(mongoUrl);

		var databaseName = mongoUrl.DatabaseName;
		if (string.IsNullOrWhiteSpace(databaseName)) {
			databaseName = string.IsNullOrWhiteSpace(options.DatabaseName) ? "changelog" : options.DatabaseName.Trim();
		}

		_db = _client.GetDatabase(databaseName);

		var prefix = NormalizePrefix(options.CollectionPrefix);
		_changesCollectionName = ResolveName(options.ChangesCollection, "changes", prefix);
		_groupsCollectionName = ResolveName(options.GroupsCollection, "groups", prefix);
		_statesCollectionName = ResolveName(options.StatesCollection, "states", prefix);

		InitializeDatabase().GetAwaiter().GetResult();
	}

	private MongoStorage(
		IMongoClient client,
		IMongoDatabase db,
		string changesCollectionName,
		string groupsCollectionName,
		string statesCollectionName,
		IClientSessionHandle session
	) {
		_client = client;
		_db = db;
		_changesCollectionName = changesCollectionName;
		_groupsCollectionName = groupsCollectionName;
		_statesCollectionName = statesCollectionName;
		_session = session;
	}

	private static string? NormalizePrefix(string? prefix) {
		if (prefix == null)
			return null;

		prefix = prefix.Trim();
		return prefix.Length == 0 ? null : prefix;
	}

	private static string ResolveName(string? explicitName, string baseName, string? prefix) {
		var name = explicitName?.Trim();
		if (string.IsNullOrWhiteSpace(name))
			name = prefix != null ? prefix + baseName : baseName;
		return name;
	}

	private async Task InitializeDatabase() {
		// Create indexes (idempotent)
		var changesIndexes = new[] {
			new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("DocumentId")),
			new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("GroupId")),
			new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys
				.Ascending("DocumentId")
				.Ascending("Timestamp"))
		};

		var groupsIndexes = new[] {
			new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys
				.Ascending("DocumentId")
				.Ascending("Timestamp"))
		};

		await Changes.Indexes.CreateManyAsync(changesIndexes);
		await Groups.Indexes.CreateManyAsync(groupsIndexes);
	}

	public async Task<T?> LoadStateAsync(string documentId) {
		var filter = Builders<BsonDocument>.Filter.Eq("_id", documentId);
		var doc = _session != null
			? await States.Find(_session, filter).FirstOrDefaultAsync()
			: await States.Find(filter).FirstOrDefaultAsync();

		if (doc == null)
			return null;

		var json = doc.GetValue("State", BsonNull.Value);
		if (json.IsBsonNull)
			return null;

		return JsonSerializer.Deserialize<T>(json.AsString);
	}

	public async Task SaveStateAsync(string documentId, T state) {
		var filter = Builders<BsonDocument>.Filter.Eq("_id", documentId);
		var update = Builders<BsonDocument>.Update
			.Set("State", JsonSerializer.Serialize(state))
			.Set("LastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
			.Inc("Version", 1);

		var options = new UpdateOptions { IsUpsert = true };
		if (_session != null)
			await States.UpdateOneAsync(_session, filter, update, options);
		else
			await States.UpdateOneAsync(filter, update, options);
	}

	public async Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		var filter = Builders<BsonDocument>.Filter.Eq("_id", documentId);
		var doc = _session != null
			? await States.Find(_session, filter).FirstOrDefaultAsync()
			: await States.Find(filter).FirstOrDefaultAsync();

		if (doc == null)
			return null;

		var json = doc.GetValue("State", BsonNull.Value);
		if (json.IsBsonNull)
			return null;

		var versionValue = doc.GetValue("Version", 1);
		var version = versionValue.IsInt32 ? versionValue.AsInt32 : Convert.ToInt32(versionValue.ToDouble());
		var document = JsonSerializer.Deserialize<T>(json.AsString);
		if (document == null)
			return null;

		return new VersionedDocument<T> { Document = document, Version = version };
	}

	public async Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		if (expectedVersion == null) {
			await SaveStateAsync(documentId, state);
			return;
		}

		// Special-case expectedVersion=0: caller expects the document to not exist yet.
		// For Mongo, we implement this by attempting an insert; if it already exists, we throw.
		if (expectedVersion.Value == 0) {
			var doc = new BsonDocument {
				{ "_id", documentId },
				{ "State", JsonSerializer.Serialize(state) },
				{ "LastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() },
				{ "Version", 1 }
			};

			try {
				if (_session != null)
					await States.InsertOneAsync(_session, doc);
				else
					await States.InsertOneAsync(doc);

				return;
			}
			catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey) {
				// Fall through to version check + concurrency exception
			}
		}

		var filter = Builders<BsonDocument>.Filter.And(
			Builders<BsonDocument>.Filter.Eq("_id", documentId),
			Builders<BsonDocument>.Filter.Eq("Version", expectedVersion.Value)
		);

		var update = Builders<BsonDocument>.Update
			.Set("State", JsonSerializer.Serialize(state))
			.Set("LastUpdated", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
			.Inc("Version", 1);

		UpdateResult result;
		if (_session != null)
			result = await States.UpdateOneAsync(_session, filter, update);
		else
			result = await States.UpdateOneAsync(filter, update);

		if (result.ModifiedCount > 0)
			return;

		// Determine current version for error
		var currentDoc = _session != null
			? await States.Find(_session, Builders<BsonDocument>.Filter.Eq("_id", documentId)).FirstOrDefaultAsync()
			: await States.Find(Builders<BsonDocument>.Filter.Eq("_id", documentId)).FirstOrDefaultAsync();

		var currentVersion = 0;
		if (currentDoc != null && currentDoc.TryGetValue("Version", out var v)) {
			currentVersion = v.IsInt32 ? v.AsInt32 : Convert.ToInt32(v.ToDouble());
		}

		throw new ConcurrencyException(documentId, expectedVersion.Value, currentVersion);
	}

	public async Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		if (changes.Count == 0)
			return;

		var docs = changes.Select(change => new BsonDocument {
			{ "DocumentId", documentId },
			{ "Path", new BsonArray(change.Path ?? Array.Empty<string>()) },
			{ "Type", (int)change.Type },
			{ "OldValue", change.OldValue != null ? JsonSerializer.Serialize(change.OldValue) : BsonNull.Value },
			{ "NewValue", change.NewValue != null ? JsonSerializer.Serialize(change.NewValue) : BsonNull.Value },
			{ "Timestamp", change.Timestamp },
			{ "GroupId", string.IsNullOrEmpty(groupId) ? BsonNull.Value : groupId }
		}).ToList();

		if (_session != null)
			await Changes.InsertManyAsync(_session, docs);
		else
			await Changes.InsertManyAsync(docs);
	}

	public async Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		options ??= new QueryOptions();

		var filter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		if (options.Since.HasValue)
			filter &= Builders<BsonDocument>.Filter.Gte("Timestamp", options.Since.Value);
		if (options.GroupId != null)
			filter &= Builders<BsonDocument>.Filter.Eq("GroupId", options.GroupId);

		var sort = Builders<BsonDocument>.Sort.Ascending("Timestamp").Ascending("_id");
		var findOptions = new FindOptions<BsonDocument> {
			Sort = sort,
			Skip = options.Skip,
			Limit = options.Take ?? options.Limit
		};

		var cursor = _session != null
			? await Changes.FindAsync(_session, filter, findOptions)
			: await Changes.FindAsync(filter, findOptions);

		var results = new List<ChangeRecord>();
		await cursor.ForEachAsync(doc => {
			results.Add(ReadChange(doc));
		});

		return results;
	}

	public async IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		options ??= new QueryOptions();

		var filter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		if (options.Since.HasValue)
			filter &= Builders<BsonDocument>.Filter.Gte("Timestamp", options.Since.Value);
		if (options.GroupId != null)
			filter &= Builders<BsonDocument>.Filter.Eq("GroupId", options.GroupId);

		var sort = Builders<BsonDocument>.Sort.Ascending("Timestamp").Ascending("_id");
		var findOptions = new FindOptions<BsonDocument> {
			Sort = sort,
			Skip = options.Skip,
			Limit = options.Take ?? options.Limit
		};

		using var cursor = _session != null
			? await Changes.FindAsync(_session, filter, findOptions, cancellationToken)
			: await Changes.FindAsync(filter, findOptions, cancellationToken);

		while (await cursor.MoveNextAsync(cancellationToken)) {
			foreach (var doc in cursor.Current) {
				cancellationToken.ThrowIfCancellationRequested();
				yield return ReadChange(doc);
			}
		}
	}

	private static ChangeRecord ReadChange(BsonDocument doc) {
		var pathArr = doc.GetValue("Path", new BsonArray());
		var path = pathArr.IsBsonArray ? pathArr.AsBsonArray.Select(v => v.AsString).ToArray() : Array.Empty<string>();
		var type = (ChangeType)doc.GetValue("Type").AsInt32;

		object? oldValue = null;
		var old = doc.GetValue("OldValue", BsonNull.Value);
		if (!old.IsBsonNull && old.IsString)
			oldValue = JsonSerializer.Deserialize<object>(old.AsString);

		object? newValue = null;
		var @new = doc.GetValue("NewValue", BsonNull.Value);
		if (!@new.IsBsonNull && @new.IsString)
			newValue = JsonSerializer.Deserialize<object>(@new.AsString);

		var timestamp = doc.GetValue("Timestamp").ToInt64();
		var groupIdValue = doc.GetValue("GroupId", BsonNull.Value);
		var groupId = groupIdValue.IsBsonNull ? null : groupIdValue.AsString;

		return new ChangeRecord {
			Path = path,
			Type = type,
			OldValue = oldValue,
			NewValue = newValue,
			Timestamp = timestamp,
			GroupId = groupId
		};
	}

	public async Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		var groupId = Guid.NewGuid().ToString();

		var doc = new BsonDocument {
			{ "_id", groupId },
			{ "DocumentId", documentId },
			{ "Timestamp", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() },
			{ "ChangeCount", 0 },
			{ "Metadata", metadata != null ? JsonSerializer.Serialize(metadata) : BsonNull.Value }
		};

		if (_session != null)
			await Groups.InsertOneAsync(_session, doc);
		else
			await Groups.InsertOneAsync(doc);

		return groupId;
	}

	public async Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		var filter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		var sort = Builders<BsonDocument>.Sort.Ascending("Timestamp").Ascending("_id");

		var cursor = _session != null
			? await Groups.FindAsync(_session, filter, new FindOptions<BsonDocument> { Sort = sort })
			: await Groups.FindAsync(filter, new FindOptions<BsonDocument> { Sort = sort });

		var results = new List<ChangeGroup>();
		await cursor.ForEachAsync(doc => {
			results.Add(ReadGroup(doc));
		});

		return results;
	}

	public async IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		var filter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		var sort = Builders<BsonDocument>.Sort.Ascending("Timestamp").Ascending("_id");

		using var cursor = _session != null
			? await Groups.FindAsync(_session, filter, new FindOptions<BsonDocument> { Sort = sort }, cancellationToken)
			: await Groups.FindAsync(filter, new FindOptions<BsonDocument> { Sort = sort }, cancellationToken);

		while (await cursor.MoveNextAsync(cancellationToken)) {
			foreach (var doc in cursor.Current) {
				cancellationToken.ThrowIfCancellationRequested();
				yield return ReadGroup(doc);
			}
		}
	}

	private static ChangeGroup ReadGroup(BsonDocument doc) {
		var id = doc.GetValue("_id").AsString;
		var timestamp = doc.GetValue("Timestamp").ToInt64();
		var changeCount = doc.GetValue("ChangeCount").AsInt32;

		Dictionary<string, object>? metadata = null;
		var meta = doc.GetValue("Metadata", BsonNull.Value);
		if (!meta.IsBsonNull && meta.IsString)
			metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(meta.AsString);

		return new ChangeGroup {
			Id = id,
			Timestamp = timestamp,
			ChangeCount = changeCount,
			Metadata = metadata
		};
	}

	public async Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		var filter = Builders<BsonDocument>.Filter.And(
			Builders<BsonDocument>.Filter.Eq("_id", groupId),
			Builders<BsonDocument>.Filter.Eq("DocumentId", documentId)
		);

		var update = Builders<BsonDocument>.Update.Set("ChangeCount", count);

		if (_session != null)
			await Groups.UpdateOneAsync(_session, filter, update);
		else
			await Groups.UpdateOneAsync(filter, update);
	}

	public async Task TrimHistoryAsync(string documentId, int maxGroups) {
		var filter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		var groupCount = _session != null
			? await Groups.CountDocumentsAsync(_session, filter)
			: await Groups.CountDocumentsAsync(filter);

		if (groupCount <= maxGroups)
			return;

		var groupsToDelete = (int)groupCount - maxGroups;
		var cursor = _session != null
			? await Groups.Find(_session, filter).SortBy(g => g["Timestamp"]).Limit(groupsToDelete).Project(Builders<BsonDocument>.Projection.Include("_id")).ToCursorAsync()
			: await Groups.Find(filter).SortBy(g => g["Timestamp"]).Limit(groupsToDelete).Project(Builders<BsonDocument>.Projection.Include("_id")).ToCursorAsync();

		var ids = new List<string>();
		await cursor.ForEachAsync(doc => ids.Add(doc.GetValue("_id").AsString));
		if (ids.Count == 0)
			return;

		var changesFilter = Builders<BsonDocument>.Filter.And(
			Builders<BsonDocument>.Filter.Eq("DocumentId", documentId),
			Builders<BsonDocument>.Filter.In("GroupId", ids)
		);

		var groupsFilter = Builders<BsonDocument>.Filter.In("_id", ids);

		if (_session != null) {
			await Changes.DeleteManyAsync(_session, changesFilter);
			await Groups.DeleteManyAsync(_session, groupsFilter);
		}
		else {
			await Changes.DeleteManyAsync(changesFilter);
			await Groups.DeleteManyAsync(groupsFilter);
		}
	}

	public async Task ClearAsync(string documentId) {
		var changesFilter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		var groupsFilter = Builders<BsonDocument>.Filter.Eq("DocumentId", documentId);
		var stateFilter = Builders<BsonDocument>.Filter.Eq("_id", documentId);

		if (_session != null) {
			await Changes.DeleteManyAsync(_session, changesFilter);
			await Groups.DeleteManyAsync(_session, groupsFilter);
			await States.DeleteOneAsync(_session, stateFilter);
		}
		else {
			await Changes.DeleteManyAsync(changesFilter);
			await Groups.DeleteManyAsync(groupsFilter);
			await States.DeleteOneAsync(stateFilter);
		}
	}

	public async Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		// Best-effort atomicity: use an explicit session/transaction if possible.
		if (_session != null) {
			await CommitGroupWithSessionAsync(_session, documentId, groupId, changes, state);
			return;
		}

		using var session = await _client.StartSessionAsync();
		try {
			session.StartTransaction();
			await CommitGroupWithSessionAsync(session, documentId, groupId, changes, state);
			await session.CommitTransactionAsync();
		}
		catch (MongoCommandException) {
			// Transactions not available (e.g., standalone). Fall back to non-transactional operations.
			await CommitGroupWithoutTransactionAsync(documentId, groupId, changes, state);
		}
		catch (NotSupportedException) {
			await CommitGroupWithoutTransactionAsync(documentId, groupId, changes, state);
		}
	}

	private async Task CommitGroupWithSessionAsync(
		IClientSessionHandle session,
		string documentId,
		string groupId,
		List<ChangeRecord> changes,
		T? state
	) {
		if (changes.Count == 0)
			return;

		// Route through a storage instance bound to the provided session.
		var transactional = new MongoStorage<T>(
			_client,
			_db,
			_changesCollectionName,
			_groupsCollectionName,
			_statesCollectionName,
			session
		);

		await transactional.AppendChangesAsync(documentId, changes, groupId);
		await transactional.UpdateGroupChangeCountAsync(documentId, groupId, changes.Count);
		if (state != null)
			await transactional.SaveStateAsync(documentId, state);
	}

	private async Task CommitGroupWithoutTransactionAsync(
		string documentId,
		string groupId,
		List<ChangeRecord> changes,
		T? state
	) {
		if (changes.Count > 0) {
			await AppendChangesAsync(documentId, changes, groupId);
			await UpdateGroupChangeCountAsync(documentId, groupId, changes.Count);
			if (state != null)
				await SaveStateAsync(documentId, state);
		}
	}

	public async Task<IChangelogTransaction> BeginTransactionAsync() {
		var session = await _client.StartSessionAsync();
		try {
			session.StartTransaction();
		}
		catch (Exception ex) {
			session.Dispose();
			throw new NotSupportedException(
				"MongoDB transactions require a replica set or sharded cluster.",
				ex
			);
		}

		var transactionalStorage = new MongoStorage<T>(
			_client,
			_db,
			_changesCollectionName,
			_groupsCollectionName,
			_statesCollectionName,
			session
		);

		return new MongoTransaction(transactionalStorage, session);
	}

	public async Task<HealthCheckResult> CheckHealthAsync() {
		var stopwatch = Stopwatch.StartNew();

		try {
			var command = new BsonDocument("ping", 1);
			_ = await _db.RunCommandAsync<BsonDocument>(command);
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
					["database"] = _db.DatabaseNamespace.DatabaseName,
					["collections"] = new[] { _statesCollectionName, _changesCollectionName, _groupsCollectionName }
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

	private sealed class MongoTransaction : IChangelogTransaction {
		private readonly IChangelogStorage<T> _storage;
		private readonly IClientSessionHandle _session;
		private bool _committed;
		private bool _rolledBack;

		public MongoTransaction(IChangelogStorage<T> storage, IClientSessionHandle session) {
			_storage = storage;
			_session = session;
		}

		public async Task CommitAsync() {
			if (_committed)
				throw new InvalidOperationException("Transaction already committed");
			if (_rolledBack)
				throw new InvalidOperationException("Transaction already rolled back");

			await _session.CommitTransactionAsync();
			_committed = true;
		}

		public async Task RollbackAsync() {
			if (_committed)
				throw new InvalidOperationException("Cannot rollback committed transaction");
			if (_rolledBack)
				return;

			await _session.AbortTransactionAsync();
			_rolledBack = true;
		}

		public async ValueTask DisposeAsync() {
			if (!_committed && !_rolledBack) {
				await RollbackAsync();
			}

			_session.Dispose();
		}

		object IChangelogTransaction.GetStorage() => _storage;
	}
}
