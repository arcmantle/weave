using NJsonSchema;
using NJsonSchema.Generation;
using System.Text.Json;
using Pivot.Core.Configuration;
using Pivot.Registry;
using Pivot.Coordinator;

Console.WriteLine("Generating Pivot Configuration JSON Schemas...");
Console.WriteLine();

// Accept output directory as first argument, default to current directory
var outputDir = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
outputDir = Path.GetFullPath(outputDir);
Directory.CreateDirectory(outputDir);

Console.WriteLine($"📂 Output directory: {outputDir}");
Console.WriteLine();

// Create schema generator settings
var settings = new SystemTextJsonSchemaGeneratorSettings {
	SchemaType = SchemaType.JsonSchema
};

// Generate individual schemas using NJsonSchema
var registrySchema = JsonSchema.FromType<RegistryOptions>(settings);
var coordinatorSchema = JsonSchema.FromType<PluginManagementOptions>(settings);

Console.WriteLine("📦 Discovered Pivot packages:");
Console.WriteLine("  - Pivot.Registry (RegistryOptions)");
Console.WriteLine("  - Pivot.Coordinator (PluginManagementOptions)");
Console.WriteLine();

// Use the new composable schema generator
Console.WriteLine("🔧 Using composable schema generator...");
var pivotContributor = new PivotSchemaContributor(
typeof(RegistryOptions),
typeof(PluginManagementOptions)
);

// Simulate additional framework contributors (example)
var contributors = new List<ISchemaContributor> {
pivotContributor
};

Console.WriteLine($"  ✓ {contributors.Count} schema contributor(s) registered");
Console.WriteLine();

var compositeSchemaDoc = PivotSchemaGenerator.ComposeSchema(contributors);
var compositeSchemaJson = JsonSerializer.Serialize(
JsonSerializer.Deserialize<object>(compositeSchemaDoc.RootElement.GetRawText()),
new JsonSerializerOptions { WriteIndented = true }
);

// Write composite schema
var outputPath = Path.Combine(outputDir, "pivot-schema.json");
await File.WriteAllTextAsync(outputPath, compositeSchemaJson);

Console.WriteLine($"✓ Generated composite schema: {outputPath}");
Console.WriteLine();

// Generate individual schemas for reference
var schemasDir = Path.Combine(outputDir, "schemas");
Directory.CreateDirectory(schemasDir);

var registryOutputPath = Path.Combine(schemasDir, "registry-schema.json");
await File.WriteAllTextAsync(registryOutputPath, registrySchema.ToJson());
Console.WriteLine($"✓ Generated Registry schema: {registryOutputPath}");

var coordinatorOutputPath = Path.Combine(schemasDir, "coordinator-schema.json");
await File.WriteAllTextAsync(coordinatorOutputPath, coordinatorSchema.ToJson());
Console.WriteLine($"✓ Generated Coordinator schema: {Path.GetFullPath(coordinatorOutputPath)}");

Console.WriteLine();
Console.WriteLine("To use these schemas in your appsettings.json, add:");
Console.WriteLine("  \"$schema\": \"./pivot-schema.json\"");
Console.WriteLine();
Console.WriteLine("💡 To add additional framework schemas (Serilog, MassTransit, etc.):");
Console.WriteLine("   1. Implement ISchemaContributor for your framework");
Console.WriteLine("   2. Add to the contributors list above");
Console.WriteLine("   3. Re-run this generator");
