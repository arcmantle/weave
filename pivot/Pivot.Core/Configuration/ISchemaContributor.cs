using System.Text.Json;

namespace Pivot.Core.Configuration;

/// <summary>
/// Interface for packages that want to contribute JSON schema definitions
/// to the composite appsettings.json schema
/// </summary>
public interface ISchemaContributor {
	/// <summary>
	/// The name of the configuration section this contributor owns
	/// (e.g., "Serilog", "MassTransit", "Pivot")
	/// </summary>
	string SectionName { get; }

	/// <summary>
	/// Priority for ordering in the composite schema (lower = higher priority)
	/// Default: 100. Framework schemas should use 0-50, application schemas 50-100, plugin schemas 100+
	/// </summary>
	int Priority => 100;

	/// <summary>
	/// Gets the JSON schema fragment for this contributor's configuration section
	/// </summary>
	/// <returns>A JSON schema object representing this section's structure</returns>
	JsonDocument GetSchemaFragment();
}

/// <summary>
/// Represents a schema contribution from an assembly attribute
/// </summary>
[AttributeUsage(AttributeTargets.Assembly, AllowMultiple = true)]
public class SchemaContributorAttribute : Attribute {
	/// <summary>
	/// The type implementing ISchemaContributor
	/// </summary>
	public Type ContributorType { get; }

	public SchemaContributorAttribute(Type contributorType) {
		if (!typeof(ISchemaContributor).IsAssignableFrom(contributorType)) {
			throw new ArgumentException(
				$"Type {contributorType} must implement ISchemaContributor",
				nameof(contributorType)
			);
		}
		ContributorType = contributorType;
	}
}
