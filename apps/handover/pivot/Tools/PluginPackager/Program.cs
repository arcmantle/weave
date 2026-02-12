using System.IO.Compression;
using System.Text.Json;
using Pivot.Plugin;

// ── Argument parsing ────────────────────────────────────────────────────────────
if (args.Length == 0 || args.Contains("--help") || args.Contains("-h"))
{
	PrintUsage();
	return args.Contains("--help") || args.Contains("-h") ? 0 : 1;
}

var projectDir = Path.GetFullPath(args[0]);
if (!Directory.Exists(projectDir))
{
	Console.Error.WriteLine($"Error: Directory not found: {projectDir}");
	return 1;
}

// Optional arguments
var outputDir = GetArg(args, "--output", "-o") ?? Path.Combine(projectDir, "bin", "packages");
var configuration = GetArg(args, "--configuration", "-c") ?? "Debug";
var framework = GetArg(args, "--framework", "-f") ?? "net10.0";
var noBuild = args.Contains("--no-build");
var verbose = args.Contains("--verbose") || args.Contains("-v");

// ── Locate plugin.json ──────────────────────────────────────────────────────────
var manifestPath = Path.Combine(projectDir, "plugin.json");
if (!File.Exists(manifestPath))
{
	Console.Error.WriteLine($"Error: plugin.json not found in {projectDir}");
	return 1;
}

var manifest = JsonSerializer.Deserialize<PluginManifest>(
	await File.ReadAllTextAsync(manifestPath),
	new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
);

if (manifest == null)
{
	Console.Error.WriteLine("Error: Failed to deserialize plugin.json");
	return 1;
}

if (string.IsNullOrWhiteSpace(manifest.Name) || string.IsNullOrWhiteSpace(manifest.Version))
{
	Console.Error.WriteLine("Error: plugin.json must have 'name' and 'version' fields");
	return 1;
}

Console.WriteLine($"Packaging {manifest.Name} v{manifest.Version}...");

// ── Locate the server project ───────────────────────────────────────────────────
var serverDir = Path.Combine(projectDir, "server");
var serverCsproj = Directory.Exists(serverDir)
	? Directory.GetFiles(serverDir, "*.csproj").FirstOrDefault()
	: Directory.GetFiles(projectDir, "*.csproj").FirstOrDefault(); // fallback: flat layout

if (serverCsproj == null)
{
	Console.Error.WriteLine("Error: No .csproj found in server/ (or project root)");
	return 1;
}

var csprojDir = Path.GetDirectoryName(serverCsproj)!;

// ── Build the project (unless --no-build) ───────────────────────────────────────
var buildOutputDir = Path.Combine(csprojDir, "bin", configuration, framework);

if (!noBuild)
{
	Console.WriteLine($"  Building ({configuration} | {framework})...");

	var buildArgs = $"build \"{serverCsproj}\" -c {configuration} -f {framework} --nologo -v q";
	var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
	{
		FileName = "dotnet",
		Arguments = buildArgs,
		RedirectStandardOutput = true,
		RedirectStandardError = true,
		UseShellExecute = false,
	})!;

	var stdout = await process.StandardOutput.ReadToEndAsync();
	var stderr = await process.StandardError.ReadToEndAsync();
	await process.WaitForExitAsync();

	if (process.ExitCode != 0)
	{
		Console.Error.WriteLine("Error: Build failed");
		if (!string.IsNullOrWhiteSpace(stdout)) Console.Error.WriteLine(stdout);
		if (!string.IsNullOrWhiteSpace(stderr)) Console.Error.WriteLine(stderr);
		return 1;
	}

	if (verbose && !string.IsNullOrWhiteSpace(stdout))
		Console.WriteLine(stdout.TrimEnd());
}

if (!Directory.Exists(buildOutputDir))
{
	Console.Error.WriteLine($"Error: Build output not found at {buildOutputDir}");
	Console.Error.WriteLine($"  Ensure the project targets {framework} or use --framework <tfm>");
	return 1;
}

// ── Assemble the package ────────────────────────────────────────────────────────
Directory.CreateDirectory(outputDir);
var packageFileName = $"{manifest.Name}-{manifest.Version}.pivotpkg";
var packagePath = Path.Combine(outputDir, packageFileName);

if (File.Exists(packagePath))
{
	try
	{
		File.Delete(packagePath);
	}
	catch (IOException)
	{
		// File might be locked — write to a temp file and move after
		Console.Error.WriteLine($"Warning: {packageFileName} is locked, writing to temp file...");
		packagePath = Path.Combine(outputDir, $"{manifest.Name}-{manifest.Version}.tmp.pivotpkg");
		if (File.Exists(packagePath)) File.Delete(packagePath);
	}
}

using (var zipStream = new FileStream(packagePath, FileMode.Create))
using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create))
{
	// 1. manifest.json (from plugin.json — the source of truth)
	var manifestJson = JsonSerializer.Serialize(manifest, new JsonSerializerOptions
	{
		WriteIndented = true,
		DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
	});
	var manifestEntry = archive.CreateEntry("manifest.json");
	await using (var writer = new StreamWriter(manifestEntry.Open()))
		await writer.WriteAsync(manifestJson);

	Log("  + manifest.json");

	// 2. server/ — DLLs and deps from build output (excluding framework assemblies)
	var serverFiles = Directory.GetFiles(buildOutputDir)
		.Where(f =>
		{
			var name = Path.GetFileName(f);
			var ext = Path.GetExtension(f).ToLowerInvariant();

			// Include DLLs except Pivot.Core (provided by host)
			if (ext == ".dll")
				return !name.StartsWith("Pivot.Core", StringComparison.OrdinalIgnoreCase);

			// Include deps.json for the plugin itself
			if (name.EndsWith(".deps.json", StringComparison.OrdinalIgnoreCase))
				return name.StartsWith(manifest.Name, StringComparison.OrdinalIgnoreCase);

			return false;
		})
		.ToList();

	if (serverFiles.Count == 0)
	{
		Console.Error.WriteLine($"Error: No DLL files found in {buildOutputDir}");
		return 1;
	}

	foreach (var file in serverFiles)
	{
		var entryName = $"server/{Path.GetFileName(file)}";
		archive.CreateEntryFromFile(file, entryName);
		Log($"  + {entryName}");
	}

	// 3. client/ — include client directory if it exists in the plugin source
	var clientDir = Path.Combine(projectDir, "client");
	if (Directory.Exists(clientDir))
	{
		foreach (var file in Directory.GetFiles(clientDir, "*", SearchOption.AllDirectories))
		{
			var relativePath = Path.GetRelativePath(projectDir, file).Replace('\\', '/');
			archive.CreateEntryFromFile(file, relativePath);
			Log($"  + {relativePath}");
		}
	}
	else
	{
		// Validation requires a client/ folder — create an empty one via a placeholder entry
		var placeholder = archive.CreateEntry("client/");
		Log("  + client/ (empty)");
	}

	// 4. README.md — root readme
	var readmePath = Path.Combine(projectDir, "README.md");
	if (File.Exists(readmePath))
	{
		archive.CreateEntryFromFile(readmePath, "README.md");
		Log("  + README.md");
	}

	// 5. server/README.md — if a dedicated server readme exists
	var serverReadmePath = Path.Combine(projectDir, "server", "README.md");
	// Also check for a convention-based name in the project root
	var serverReadmeAlt = Path.Combine(projectDir, "README.server.md");
	if (File.Exists(serverReadmePath))
	{
		archive.CreateEntryFromFile(serverReadmePath, "server/README.md");
		Log("  + server/README.md");
	}
	else if (File.Exists(serverReadmeAlt))
	{
		archive.CreateEntryFromFile(serverReadmeAlt, "server/README.md");
		Log("  + server/README.md (from README.server.md)");
	}

	// 6. client/README.md — if a dedicated client readme exists
	var clientReadmePath = Path.Combine(projectDir, "client", "README.md");
	var clientReadmeAlt = Path.Combine(projectDir, "README.client.md");
	if (File.Exists(clientReadmePath))
	{
		// Already included in step 3 if client/ dir existed
		if (!Directory.Exists(clientDir))
		{
			archive.CreateEntryFromFile(clientReadmePath, "client/README.md");
			Log("  + client/README.md");
		}
	}
	else if (File.Exists(clientReadmeAlt))
	{
		archive.CreateEntryFromFile(clientReadmeAlt, "client/README.md");
		Log("  + client/README.md (from README.client.md)");
	}
}

var fileInfo = new FileInfo(packagePath);
Console.WriteLine();
Console.WriteLine($"Created {packageFileName} ({FormatSize(fileInfo.Length)})");
Console.WriteLine($"  {packagePath}");

return 0;


// ── Helpers ─────────────────────────────────────────────────────────────────────
void Log(string message)
{
	if (verbose)
		Console.WriteLine(message);
}

static string FormatSize(long bytes)
{
	return bytes switch
	{
		< 1024 => $"{bytes} B",
		< 1048576 => $"{bytes / 1024.0:F1} KB",
		_ => $"{bytes / 1048576.0:F1} MB",
	};
}

static string? GetArg(string[] args, string longName, string shortName)
{
	for (var i = 0; i < args.Length - 1; i++)
	{
		if (args[i] == longName || args[i] == shortName)
			return args[i + 1];
	}

	return null;
}

static void PrintUsage()
{
	Console.WriteLine("""
	Pivot Plugin Packager — Creates .pivotpkg files from plugin projects

	Usage:
	  dotnet run --project <PluginPackager> -- <plugin-dir> [options]

	Arguments:
	  <plugin-dir>              Path to the plugin project directory (must contain plugin.json)

	Options:
	  -o, --output <dir>        Output directory for the .pivotpkg file
	                            (default: <plugin-dir>/bin/packages)
	  -c, --configuration <cfg> Build configuration (default: Debug)
	  -f, --framework <tfm>     Target framework (default: net10.0)
	  --no-build                Skip building, use existing build output
	  -v, --verbose             Show detailed output
	  -h, --help                Show this help

	Examples:
	  dotnet run -- ../Samples/Plugins/WeatherPlugin
	  dotnet run -- ../Samples/Plugins/WeatherPlugin -o ./packages -c Release
	  dotnet run -- ../Samples/Plugins/WeatherPlugin --no-build -v

	Package structure:
	  manifest.json            ← from plugin.json
	  server/                  ← compiled DLLs (excludes Pivot.Core)
	  client/                  ← frontend assets (if client/ dir exists)
	  README.md                ← from project root (optional)

	README conventions:
	  README.md                → root readme in package
	  server/README.md         → server readme (or README.server.md in project root)
	  client/README.md         → client readme (or README.client.md in project root)
	""");
}
