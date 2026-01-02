namespace Changelog.Storage;

public sealed class MongoStorageOptions {
	/// <summary>
	/// Database name to use when the connection string does not specify one.
	/// Defaults to "changelog".
	/// </summary>
	public string? DatabaseName { get; init; }

	/// <summary>
	/// Optional prefix applied to all collection names (e.g. "myapp_").
	/// </summary>
	public string? CollectionPrefix { get; init; }

	/// <summary>
	/// Optional explicit collection name for change records.
	/// Defaults to "changes" (or "{CollectionPrefix}changes").
	/// </summary>
	public string? ChangesCollection { get; init; }

	/// <summary>
	/// Optional explicit collection name for change groups.
	/// Defaults to "groups" (or "{CollectionPrefix}groups").
	/// </summary>
	public string? GroupsCollection { get; init; }

	/// <summary>
	/// Optional explicit collection name for document states.
	/// Defaults to "states" (or "{CollectionPrefix}states").
	/// </summary>
	public string? StatesCollection { get; init; }
}
