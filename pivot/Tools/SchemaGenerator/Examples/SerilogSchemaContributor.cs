using System.Text.Json;
using Pivot.Core.Configuration;

namespace Example.Serilog;

/// <summary>
/// Example schema contributor for Serilog logging framework
/// This demonstrates how third-party frameworks can contribute to the composite schema
/// </summary>
public class SerilogSchemaContributor : ISchemaContributor
{
	public string SectionName => "Serilog";
	public int Priority => 20; // Framework-level, but after Pivot

	public JsonDocument GetSchemaFragment()
	{
		var schema = new
		{
			type = "object",
			description = "Serilog structured logging configuration",
			properties = new
			{
				MinimumLevel = new
				{
					type = "object",
					properties = new
					{
						Default = new
						{
							type = "string",
							@enum = new[] { "Verbose", "Debug", "Information", "Warning", "Error", "Fatal" },
							description = "Default minimum log level"
						},
						Override = new
						{
							type = "object",
							additionalProperties = new
							{
								type = "string",
								@enum = new[] { "Verbose", "Debug", "Information", "Warning", "Error", "Fatal" }
							},
							description = "Override log levels by namespace"
						}
					}
				},
				WriteTo = new
				{
					type = "array",
					description = "Sinks to write log events to",
					items = new
					{
						type = "object",
						properties = new
						{
							Name = new
							{
								type = "string",
								description = "Sink name (e.g., 'Console', 'File', 'Seq')"
							},
							Args = new
							{
								type = "object",
								description = "Sink-specific arguments"
							}
						}
					}
				},
				Enrich = new
				{
					type = "array",
					description = "Enrichers to add contextual information",
					items = new
					{
						type = "string"
					}
				}
			}
		};

		return JsonDocument.Parse(JsonSerializer.Serialize(schema));
	}
}
