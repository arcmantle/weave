using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using BenchmarkDotNet.Attributes;
using Changelog.Storage;
using Microsoft.Data.Sqlite;

namespace Changelog.Benchmarks;

[MemoryDiagnoser]
public class SqliteBenchmarks {
	private const string DocumentId = "bench-doc";
	private const int DocumentOpsPerInvoke = 1024;

	private const int ConcurrentReaders = 8;
	private const int ConcurrentReadsPerReader = 512;
	private const int ConcurrentWrites = 512;
	private const int ConcurrentOpsPerInvoke = (ConcurrentReaders * ConcurrentReadsPerReader) + ConcurrentWrites;

	[ParamsSource(nameof(ChangeCounts))]
	public int ChangeCount { get; set; }

	[ParamsSource(nameof(GroupSizes))]
	public int GroupSize { get; set; }

	[ParamsSource(nameof(StorageModes))]
	public string StorageMode { get; set; } = "sqlite";

	// Keep page size fixed to avoid multiplying benchmark matrix.
	public int PageSize { get; set; } = 1_000;

	private string _dbPath = string.Empty;
	private string _connectionString = string.Empty;
	private IChangelogStorage<BenchDoc> _storage = null!;
	private CachedStorage<BenchDoc>? _cachedStorage;
	private Changelog<BenchDoc> _changelog = null!;

	public IEnumerable<int> ChangeCounts() {
		var raw = Environment.GetEnvironmentVariable("CHANGELOG_BENCH_CHANGE_COUNTS");
		if (!string.IsNullOrWhiteSpace(raw)) {
			foreach (var v in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) {
				if (int.TryParse(v, out var n) && n > 0)
					yield return n;
			}
			yield break;
		}

		yield return 100;
		yield return 1_000;
		yield return 10_000;
		yield return 100_000;
		yield return 1_000_000;
	}

	public IEnumerable<int> GroupSizes() {
		var raw = Environment.GetEnvironmentVariable("CHANGELOG_BENCH_GROUP_SIZES");
		if (!string.IsNullOrWhiteSpace(raw)) {
			foreach (var v in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) {
				if (int.TryParse(v, out var n) && n > 0)
					yield return n;
			}
			yield break;
		}

		// Keep a single default to avoid exploding benchmark permutations.
		yield return 1_000;
	}

	public IEnumerable<string> StorageModes() {
		var raw = Environment.GetEnvironmentVariable("CHANGELOG_BENCH_STORAGE_MODES");
		if (!string.IsNullOrWhiteSpace(raw)) {
			foreach (var v in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) {
				yield return v;
			}
			yield break;
		}

		yield return "sqlite";
		yield return "sqlite+cache";
	}

	[GlobalSetup]
	public async Task GlobalSetup() {
		var artifacts = Path.Combine(AppContext.BaseDirectory, "artifacts");
		Directory.CreateDirectory(artifacts);

		_dbPath = Path.Combine(artifacts, $"sqlite_changes_{ChangeCount}_gs{GroupSize}.db");
		_connectionString = $"Data Source={_dbPath}";

		if (!File.Exists(_dbPath)) {
			await DatasetGenerator.GenerateAsync(_connectionString, DocumentId, ChangeCount, GroupSize);
		}

		_storage = CreateStorage(StorageMode, _connectionString);
		_cachedStorage = _storage as CachedStorage<BenchDoc>;
		_changelog = new Changelog<BenchDoc>(_storage, DocumentId);
	}

	[GlobalCleanup]
	public void GlobalCleanup() {
		try {
			SqliteConnection.ClearAllPools();
		}
		catch {
			// ignore
		}
	}

	[Benchmark]
	public Task<BenchDoc?> GetDocumentAsync() {
		return _changelog.GetDocumentAsync();
	}

	// Cold-cache semantics:
	// - For StorageMode=sqlite+cache: measures cache MISS by clearing the cache before each operation.
	// - For StorageMode=sqlite: equivalent to the baseline document read path.
	//
	// We batch operations to avoid BenchmarkDotNet harness overhead dominating tiny benchmarks.
	[Benchmark(OperationsPerInvoke = DocumentOpsPerInvoke)]
	public async Task<int> GetDocumentColdAsync() {
		var checksum = 0;

		for (var i = 0; i < DocumentOpsPerInvoke; i++) {
			_cachedStorage?.ClearCache();
			var doc = await _changelog.GetDocumentAsync();
			checksum ^= doc?.Counter ?? 0;
		}

		return checksum;
	}

	// Warm-cache semantics:
	// - For StorageMode=sqlite+cache: measures cache HIT (after one prime read).
	// - For StorageMode=sqlite: equivalent to the baseline document read path.
	[Benchmark(OperationsPerInvoke = DocumentOpsPerInvoke)]
	public async Task<int> GetDocumentWarmAsync() {
		var checksum = 0;

		if (StorageMode.Equals("sqlite+cache", StringComparison.OrdinalIgnoreCase)) {
			// Prime once; amortized across the batch.
			var _ = await _changelog.GetDocumentAsync();
		}

		for (var i = 0; i < DocumentOpsPerInvoke; i++) {
			var doc = await _changelog.GetDocumentAsync();
			checksum ^= doc?.Counter ?? 0;
		}

		return checksum;
	}

	// Concurrent read/write scenario:
	// - Many readers call GetDocumentAsync while a single writer applies small updates.
	// - Uses separate Changelog instances per task, sharing the underlying storage (and cache, if enabled).
	[Benchmark(OperationsPerInvoke = ConcurrentOpsPerInvoke)]
	public async Task<int> ConcurrentReadWriteAsync() {
		var readerTasks = new Task<int>[ConcurrentReaders];
		for (var r = 0; r < ConcurrentReaders; r++) {
			readerTasks[r] = Task.Run(async () => {
				var checksum = 0;
				var changelog = new Changelog<BenchDoc>(_storage, DocumentId);
				for (var i = 0; i < ConcurrentReadsPerReader; i++) {
					var doc = await changelog.GetDocumentAsync();
					checksum ^= doc?.Counter ?? 0;
				}
				return checksum;
			});
		}

		var writerTask = Task.Run(async () => {
			var checksum = 0;
			var changelog = new Changelog<BenchDoc>(_storage, DocumentId);
			var doc = await changelog.GetDocumentAsync();
			var counter = doc?.Counter ?? 0;

			for (var i = 0; i < ConcurrentWrites; i++) {
				counter++;
				await changelog.ApplyChangesAsync(new BenchDoc { Counter = counter });
				checksum ^= counter;
			}

			return checksum;
		});

		var writerChecksum = await writerTask;
		var readerChecksums = await Task.WhenAll(readerTasks);

		var total = writerChecksum;
		foreach (var c in readerChecksums) {
			total ^= c;
		}

		return total;
	}

	[Benchmark]
	public Task<List<ChangeRecord>> GetHistoryFirstPageAsync() {
		return _changelog.GetHistoryAsync(new QueryOptions { Take = PageSize });
	}

	[Benchmark]
	public Task<List<ChangeRecord>> GetHistoryLastPageAsync() {
		var skip = Math.Max(0, ChangeCount - PageSize);
		return _changelog.GetHistoryAsync(new QueryOptions { Skip = skip, Take = PageSize });
	}

	[Benchmark]
	public async Task<int> StreamHistoryFirstPageAsync() {
		var n = 0;
		await foreach (var _ in _changelog.GetHistoryStreamAsync(new QueryOptions { Take = PageSize })) {
			n++;
			if (n >= PageSize)
				break;
		}
		return n;
	}

	[Benchmark]
	public Task<List<ChangeGroup>> GetGroupsAsync() {
		return _storage.GetGroupsAsync(DocumentId);
	}

	private static IChangelogStorage<BenchDoc> CreateStorage(string storageMode, string connectionString) {
		IChangelogStorage<BenchDoc> storage = new SqliteStorage<BenchDoc>(connectionString);

		if (storageMode.Equals("sqlite+cache", StringComparison.OrdinalIgnoreCase)) {
			storage = new CachedStorage<BenchDoc>(storage, cacheCapacity: 128);
		}

		return storage;
	}
}
