namespace Changelog.Storage;

public sealed class SqliteStorageOptions {
	/// <summary>
	/// Optional prefix applied to all table names (e.g. "myapp_").
	/// Ignored for any table where an explicit name is provided.
	/// </summary>
	public string? TablePrefix { get; init; }

	/// <summary>
	/// Optional explicit table name for change records.
	/// Defaults to "Changes" (or "{TablePrefix}Changes").
	/// </summary>
	public string? ChangesTable { get; init; }

	/// <summary>
	/// Optional explicit table name for change groups.
	/// Defaults to "Groups" (or "{TablePrefix}Groups").
	/// </summary>
	public string? GroupsTable { get; init; }

	/// <summary>
	/// Optional explicit table name for document states.
	/// Defaults to "States" (or "{TablePrefix}States").
	/// </summary>
	public string? StatesTable { get; init; }
}
