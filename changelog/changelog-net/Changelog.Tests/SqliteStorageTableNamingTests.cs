using System;
using System.IO;
using System.Threading.Tasks;
using Changelog.Storage;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Changelog.Tests;

public class SqliteStorageTableNamingTests {
	private class TestDoc {
		public int Id { get; set; }
		public string? Name { get; set; }
	}

	[Fact]
	public async Task SqliteStorage_TablePrefix_ShouldCreateAndUsePrefixedTables() {
		var dbPath = Path.Combine(Path.GetTempPath(), $"table_naming_{Guid.NewGuid()}.db");
		var options = new SqliteStorageOptions { TablePrefix = "myapp_" };

		var storage = new SqliteStorage<TestDoc>($"Data Source={dbPath}", options);
		await storage.SaveStateAsync("doc1", new TestDoc { Id = 1, Name = "Test" });

		try {
			var result = await storage.CheckHealthAsync();
			Assert.Equal(HealthStatus.Healthy, result.Status);
			Assert.NotNull(result.Data);
			Assert.Equal(3L, result.Data["tableCount"]);

			await using var connection = new SqliteConnection($"Data Source={dbPath}");
			await connection.OpenAsync();

			var cmd = connection.CreateCommand();
			cmd.CommandText = @"
				SELECT COUNT(*)
				FROM sqlite_master
				WHERE type='table' AND name IN (@states, @changes, @groups)
			";
			cmd.Parameters.AddWithValue("@states", "myapp_States");
			cmd.Parameters.AddWithValue("@changes", "myapp_Changes");
			cmd.Parameters.AddWithValue("@groups", "myapp_Groups");

			var count = (long)(await cmd.ExecuteScalarAsync())!;
			Assert.Equal(3L, count);
		}
		finally {
			SqliteConnection.ClearAllPools();
			if (File.Exists(dbPath))
				File.Delete(dbPath);
		}
	}
}
