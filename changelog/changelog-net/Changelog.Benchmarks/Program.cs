using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using BenchmarkDotNet.Running;
using Changelog.Storage;
using Microsoft.Data.Sqlite;

namespace Changelog.Benchmarks;

internal static class Program {
	public static int Main(string[] args) {
		// Optional overrides to avoid running the full 100..1,000,000 matrix.
		// Examples:
		//  - set CHANGELOG_BENCH_CHANGE_COUNTS=100000
		//  - set CHANGELOG_BENCH_STORAGE_MODES=sqlite,sqlite+cache
		// Or via args:
		//  --changes 100000,1000000 --storage sqlite,sqlite+cache
		var bdnArgs = new string[args.Length];
		var outIdx = 0;
		for (var i = 0; i < args.Length; i++) {
			if (args[i] == "--changes" && i + 1 < args.Length) {
				Environment.SetEnvironmentVariable("CHANGELOG_BENCH_CHANGE_COUNTS", args[i + 1]);
				i++;
				continue;
			}
			if (args[i] == "--group-size" && i + 1 < args.Length) {
				Environment.SetEnvironmentVariable("CHANGELOG_BENCH_GROUP_SIZES", args[i + 1]);
				i++;
				continue;
			}
			if (args[i] == "--storage" && i + 1 < args.Length) {
				Environment.SetEnvironmentVariable("CHANGELOG_BENCH_STORAGE_MODES", args[i + 1]);
				i++;
				continue;
			}

			bdnArgs[outIdx++] = args[i];
		}

		// BenchmarkDotNet will parse its own args like --filter, --list, etc.
		if (outIdx != bdnArgs.Length) {
			Array.Resize(ref bdnArgs, outIdx);
		}
		BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(bdnArgs);
		return 0;
	}
}

internal static class DatasetGenerator {
	public static async Task GenerateAsync(
		string connectionString,
		string documentId,
		int changeCount,
		int groupSize
	) {
		// Ensure schema exists by constructing the storage once.
		_ = new SqliteStorage<BenchDoc>(connectionString);

		await using var connection = new SqliteConnection(connectionString);
		await connection.OpenAsync();

		// Clear previous data for this document
		await using (var clearCmd = connection.CreateCommand()) {
			clearCmd.CommandText = @"
DELETE FROM Changes WHERE DocumentId = @documentId;
DELETE FROM Groups WHERE DocumentId = @documentId;
DELETE FROM States WHERE DocumentId = @documentId;";
			clearCmd.Parameters.AddWithValue("@documentId", documentId);
			await clearCmd.ExecuteNonQueryAsync();
		}

		var start = Stopwatch.StartNew();
		var groups = (int)Math.Ceiling(changeCount / (double)groupSize);

		// Insert groups and changes. Chunk transactions so 1M inserts stays manageable.
		const int transactionChunk = 50_000;
		var inserted = 0;
		var counter = 0;
		var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

		await InsertGroupsAsync(connection, documentId, now, groups, groupSize, changeCount);

		while (inserted < changeCount) {
			await using var tx = (SqliteTransaction)await connection.BeginTransactionAsync();

			await using var insertChange = connection.CreateCommand();
			insertChange.Transaction = tx;
			insertChange.CommandText = @"
INSERT INTO Changes (DocumentId, Path, Type, OldValue, NewValue, Timestamp, GroupId)
VALUES (@documentId, @path, @type, @oldValue, @newValue, @timestamp, @groupId);";

			var pDoc = insertChange.CreateParameter();
			pDoc.ParameterName = "@documentId";
			pDoc.Value = documentId;
			insertChange.Parameters.Add(pDoc);

			var pPath = insertChange.CreateParameter();
			pPath.ParameterName = "@path";
			insertChange.Parameters.Add(pPath);

			var pType = insertChange.CreateParameter();
			pType.ParameterName = "@type";
			insertChange.Parameters.Add(pType);

			var pOld = insertChange.CreateParameter();
			pOld.ParameterName = "@oldValue";
			insertChange.Parameters.Add(pOld);

			var pNew = insertChange.CreateParameter();
			pNew.ParameterName = "@newValue";
			insertChange.Parameters.Add(pNew);
			var pTs = insertChange.CreateParameter();
			pTs.ParameterName = "@timestamp";
			insertChange.Parameters.Add(pTs);

			var pGroup = insertChange.CreateParameter();
			pGroup.ParameterName = "@groupId";
			insertChange.Parameters.Add(pGroup);

			var chunkTarget = Math.Min(changeCount, inserted + transactionChunk);
			for (; inserted < chunkTarget; inserted++) {
				var previous = counter;
				counter++;

				var groupIndex = inserted / groupSize;
				var groupId = $"g-{groupIndex:D6}";

				pPath.Value = JsonSerializer.Serialize(new[] { "counter" });
				pType.Value = (int)ChangeType.Set;
				pOld.Value = JsonSerializer.Serialize(previous);
				pNew.Value = JsonSerializer.Serialize(counter);
				pTs.Value = now + inserted;
				pGroup.Value = groupId;

				await insertChange.ExecuteNonQueryAsync();
			}

			await tx.CommitAsync();
		}

		// Save final state
		var finalDoc = new BenchDoc {
			Counter = counter,
			Payload = new string('x', 256)
		};

		await using (var stateCmd = connection.CreateCommand()) {
			stateCmd.CommandText = @"
INSERT INTO States (DocumentId, State, LastUpdated, Version)
VALUES (@documentId, @state, @lastUpdated, @version);";
			stateCmd.Parameters.AddWithValue("@documentId", documentId);
			stateCmd.Parameters.AddWithValue("@state", JsonSerializer.Serialize(finalDoc));
			stateCmd.Parameters.AddWithValue("@lastUpdated", now + changeCount);
			stateCmd.Parameters.AddWithValue("@version", changeCount + 1);
			await stateCmd.ExecuteNonQueryAsync();
		}

		start.Stop();
		Console.WriteLine($"Dataset generation complete in {start.Elapsed.TotalSeconds:F1}s");
	}

	private static async Task InsertGroupsAsync(
		SqliteConnection connection,
		string documentId,
		long baseTimestamp,
		int groups,
		int groupSize,
		int totalChanges
	) {
		await using var tx = (SqliteTransaction)await connection.BeginTransactionAsync();
		await using var cmd = connection.CreateCommand();
		cmd.Transaction = tx;
		cmd.CommandText = @"
INSERT INTO Groups (Id, DocumentId, Timestamp, ChangeCount, Metadata)
VALUES (@id, @documentId, @timestamp, @changeCount, @metadata);";

		var pId = cmd.CreateParameter();
		pId.ParameterName = "@id";
		cmd.Parameters.Add(pId);

		var pDoc = cmd.CreateParameter();
		pDoc.ParameterName = "@documentId";
		pDoc.Value = documentId;
		cmd.Parameters.Add(pDoc);

		var pTs = cmd.CreateParameter();
		pTs.ParameterName = "@timestamp";
		cmd.Parameters.Add(pTs);

		var pCount = cmd.CreateParameter();
		pCount.ParameterName = "@changeCount";
		cmd.Parameters.Add(pCount);

		var pMeta = cmd.CreateParameter();
		pMeta.ParameterName = "@metadata";
		pMeta.Value = DBNull.Value;
		cmd.Parameters.Add(pMeta);

		for (var g = 0; g < groups; g++) {
			pId.Value = $"g-{g:D6}";
			pTs.Value = baseTimestamp + (long)g * groupSize;
			var remaining = totalChanges - g * groupSize;
			pCount.Value = Math.Min(groupSize, remaining);
			await cmd.ExecuteNonQueryAsync();
		}

		await tx.CommitAsync();
	}
}
