using System.Reflection;
using System.Text.Json;

namespace Pivot.Core.Configuration;

/// <summary>
/// Discovers and composes JSON schemas from multiple contributors
/// </summary>
public static class PivotSchemaGenerator {
	/// <summary>
	/// Discovers all ISchemaContributor implementations from loaded assemblies
	/// and generates a composite schema for appsettings.json
	/// </summary>
	public static JsonDocument GenerateCompositeSchema(params Assembly[] assemblies) {
		var contributors = DiscoverContributors(assemblies);
		return ComposeSchema(contributors);
	}

	/// <summary>
	/// Generates a composite schema from explicitly provided contributors
	/// </summary>
	public static JsonDocument ComposeSchema(IEnumerable<ISchemaContributor> contributors) {
		var properties = new Dictionary<string, object> {
			["Logging"] = new {
				type = "object",
				description = "ASP.NET Core logging configuration",
				properties = new {
					LogLevel = new {
						type = "object",
						additionalProperties = new {
							type = "string",
							@enum = new[] { "Trace", "Debug", "Information", "Warning", "Error", "Critical", "None" }
						}
					}
				}
			},
			["AllowedHosts"] = new {
				type = "string",
				description = "Semicolon-separated list of allowed host names"
			},
			["Urls"] = new {
				type = "string",
				description = "Server URLs to listen on (e.g., 'http://localhost:5000')"
			},
			["ApplicationName"] = new {
				type = "string",
				description = "Application name for data directory isolation"
			},
			["AccessMode"] = new {
				type = "string",
				description = "Registry access mode: Public allows unauthenticated browsing/downloading, Private requires authentication for all operations",
				@enum = new[] { "Public", "Private" }
			}
		};

		// Add contributors by priority
		foreach (var contributor in contributors.OrderBy(c => c.Priority)) {
			var fragment = contributor.GetSchemaFragment();
			var root = fragment.RootElement;

			properties[contributor.SectionName] = JsonSerializer.Deserialize<object>(root.GetRawText())!;
		}

		var schema = new {
			@schema = "http://json-schema.org/draft-07/schema#",
			title = "Application Configuration",
			description = "Composite configuration schema from multiple frameworks",
			type = "object",
			properties
		};

		return JsonDocument.Parse(JsonSerializer.Serialize(schema));
	}

	/// <summary>
	/// Discovers schema contributors from assemblies via [SchemaContributor] attributes
	/// </summary>
	public static List<ISchemaContributor> DiscoverContributors(params Assembly[] assemblies) {
		var contributors = new List<ISchemaContributor>();

		var assembliesToScan = assemblies.Length > 0
			? assemblies
			: AppDomain.CurrentDomain.GetAssemblies();

		foreach (var assembly in assembliesToScan) {
			try {
				var attributes = assembly.GetCustomAttributes<SchemaContributorAttribute>();
				foreach (var attr in attributes) {
					var instance = Activator.CreateInstance(attr.ContributorType) as ISchemaContributor;
					if (instance != null) {
						contributors.Add(instance);
					}
				}
			}
			catch {
				// Skip assemblies that can't be scanned
			}
		}

		return contributors;
	}
}
