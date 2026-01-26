using System.Text.Json;
using NJsonSchema;
using NJsonSchema.Generation;

namespace Pivot.Core.Configuration;

/// <summary>
/// Schema contributor for Pivot Framework configuration
/// </summary>
public class PivotSchemaContributor : ISchemaContributor {
	private readonly Type[] _optionsTypes;

	public string SectionName => "Pivot";
	public int Priority => 10; // Framework-level priority

	public PivotSchemaContributor(params Type[] optionsTypes) {
		_optionsTypes = optionsTypes;
	}

	public JsonDocument GetSchemaFragment() {
		var settings = new SystemTextJsonSchemaGeneratorSettings {
			SchemaType = SchemaType.JsonSchema
		};

		var properties = new Dictionary<string, object>();

		foreach (var optionsType in _optionsTypes) {
			var schema = JsonSchema.FromType(optionsType, settings);
			var sectionName = GetSectionName(optionsType);

			properties[sectionName] = JsonSerializer.Deserialize<object>(schema.ToJson())!;
		}

		var pivotSchema = new {
			type = "object",
			description = "Pivot Framework configuration",
			properties
		};

		return JsonDocument.Parse(JsonSerializer.Serialize(pivotSchema));
	}

	private static string GetSectionName(Type type) {
		// Remove "Options" suffix if present
		var name = type.Name;
		if (name.EndsWith("Options")) {
			name = name[..^7]; // Remove "Options"
		}
		return name;
	}
}
