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
			SchemaType = SchemaType.JsonSchema,
			FlattenInheritanceHierarchy = true,
		};

		var properties = new Dictionary<string, object>();

		foreach (var optionsType in _optionsTypes) {
			var schema = JsonSchema.FromType(optionsType, settings);

			// Inline all $ref definitions so the sub-schema is self-contained
			// and doesn't produce broken root-level $ref paths when embedded.
			var schemaJson = schema.ToJson();
			var doc = JsonDocument.Parse(schemaJson);
			var inlined = InlineDefinitions(doc);

			var sectionName = GetSectionName(optionsType);
			properties[sectionName] = JsonSerializer.Deserialize<object>(inlined)!;
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

	/// <summary>
	/// Resolves all $ref pointers by inlining the referenced definitions,
	/// then removes the definitions block entirely. This ensures the schema
	/// is self-contained when embedded inside a composite schema.
	/// </summary>
	private static string InlineDefinitions(JsonDocument doc) {
		var root = doc.RootElement;

		// Collect definitions if present
		var definitions = new Dictionary<string, JsonElement>();
		if (root.TryGetProperty("definitions", out var defs)) {
			foreach (var def in defs.EnumerateObject()) {
				definitions[def.Name] = def.Value;
			}
		}

		if (definitions.Count == 0)
			return root.GetRawText();

		// Rebuild the JSON, replacing $ref with inlined definitions
		using var stream = new System.IO.MemoryStream();
		using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true })) {
			WriteElementWithInlining(writer, root, definitions, skipDefinitions: true);
		}

		return System.Text.Encoding.UTF8.GetString(stream.ToArray());
	}

	private static void WriteElementWithInlining(
		Utf8JsonWriter writer,
		JsonElement element,
		Dictionary<string, JsonElement> definitions,
		bool skipDefinitions = false) {

		switch (element.ValueKind) {
		case JsonValueKind.Object:
			// Check if this object is a $ref
			if (element.TryGetProperty("$ref", out var refValue)) {
				var refPath = refValue.GetString();
				if (refPath != null && refPath.StartsWith("#/definitions/")) {
					var defName = refPath["#/definitions/".Length..];
					if (definitions.TryGetValue(defName, out var defElement)) {
						WriteElementWithInlining(writer, defElement, definitions);
						return;
					}
				}
			}

			writer.WriteStartObject();
			foreach (var prop in element.EnumerateObject()) {
				// Skip the definitions block itself
				if (skipDefinitions && prop.Name == "definitions")
					continue;

				writer.WritePropertyName(prop.Name);
				WriteElementWithInlining(writer, prop.Value, definitions);
			}
			writer.WriteEndObject();
			break;

		case JsonValueKind.Array:
			writer.WriteStartArray();
			foreach (var item in element.EnumerateArray()) {
				WriteElementWithInlining(writer, item, definitions);
			}
			writer.WriteEndArray();
			break;

		default:
			element.WriteTo(writer);
			break;
		}
	}
}
