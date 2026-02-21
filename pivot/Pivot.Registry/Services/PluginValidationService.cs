using System.IO.Compression;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Pivot.Plugin;

namespace Pivot.Registry.Services;

public class PluginValidationService {
	private readonly ILogger<PluginValidationService> _logger;

	public PluginValidationService(ILogger<PluginValidationService> logger) {
		_logger = logger;
	}

	public class ValidationResult {
		public bool IsValid { get; set; }
		public List<string> Errors { get; set; } = new();
		public PluginManifest? Manifest { get; set; }
		public long PackageSize { get; set; }
	}

	public async Task<ValidationResult> ValidatePackageAsync(Stream packageStream, CancellationToken cancellationToken = default) {
		var result = new ValidationResult();

		try {
			// Reset stream position
			if (packageStream.CanSeek) {
				packageStream.Position = 0;
				result.PackageSize = packageStream.Length;
			}

			using var archive = new ZipArchive(packageStream, ZipArchiveMode.Read, leaveOpen: true);

			// Validate package structure
			if (!ValidatePackageStructure(archive, result)) {
				return result;
			}

			// Extract and validate manifest
			var manifestEntry = archive.GetEntry("manifest.json");
			if (manifestEntry == null) {
				result.Errors.Add("manifest.json not found in package root");
				return result;
			}

			await using var manifestStream = manifestEntry.Open();
			result.Manifest = await JsonSerializer.DeserializeAsync<PluginManifest>(manifestStream, cancellationToken: cancellationToken);

			if (result.Manifest == null) {
				result.Errors.Add("Failed to deserialize manifest.json");
				return result;
			}

			// Validate manifest fields
			if (!ValidateManifest(result.Manifest, result)) {
				return result;
			}

			// Validate server DLLs
			if (!ValidateServerAssemblies(archive, result)) {
				return result;
			}

			result.IsValid = result.Errors.Count == 0;
			return result;
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Error validating package");
			result.Errors.Add($"Validation error: {ex.Message}");
			return result;
		}
	}

	private bool ValidatePackageStructure(ZipArchive archive, ValidationResult result) {
		var hasClientFolder = false;
		var hasServerFolder = false;
		var hasManifest = false;

		foreach (var entry in archive.Entries) {
			if (entry.FullName == "manifest.json") {
				hasManifest = true;
			}
			else if (entry.FullName.StartsWith("client/")) {
				hasClientFolder = true;
			}
			else if (entry.FullName.StartsWith("server/")) {
				hasServerFolder = true;
			}
		}

		if (!hasManifest) {
			result.Errors.Add("Package must contain manifest.json in root");
		}

		if (!hasClientFolder) {
			result.Errors.Add("Package must contain /client/ folder");
		}

		if (!hasServerFolder) {
			result.Errors.Add("Package must contain /server/ folder");
		}

		return hasManifest && hasClientFolder && hasServerFolder;
	}

	private bool ValidateManifest(PluginManifest manifest, ValidationResult result) {
		if (string.IsNullOrWhiteSpace(manifest.Name)) {
			result.Errors.Add("Manifest: name is required");
		}

		if (string.IsNullOrWhiteSpace(manifest.Version)) {
			result.Errors.Add("Manifest: version is required");
		}
		else if (!IsValidSemVer(manifest.Version)) {
			result.Errors.Add($"Manifest: version '{manifest.Version}' is not valid semantic version");
		}

		return result.Errors.Count == 0;
	}

	private bool ValidateServerAssemblies(ZipArchive archive, ValidationResult result) {
		var serverEntries = archive.Entries
			 .Where(e => e.FullName.StartsWith("server/") && e.FullName.EndsWith(".dll"))
			 .ToList();

		if (serverEntries.Count == 0) {
			result.Errors.Add("No DLL files found in /server/ folder");
			return false;
		}

		foreach (var entry in serverEntries) {
			try {
				using var stream = entry.Open();
				using var memoryStream = new MemoryStream();
				stream.CopyTo(memoryStream);
				memoryStream.Position = 0;

				// Validate PE structure
				using var peReader = new PEReader(memoryStream);

				if (!peReader.HasMetadata) {
					result.Errors.Add($"Assembly {entry.Name} does not have valid metadata");
					continue;
				}

				// Basic metadata validation
				var metadataReader = peReader.GetMetadataReader();

				// Check that it's a valid .NET assembly
				if (!metadataReader.IsAssembly) {
					result.Errors.Add($"File {entry.Name} is not a valid .NET assembly");
				}

				_logger.LogDebug("Validated assembly: {AssemblyName}", entry.Name);
			}
			catch (BadImageFormatException ex) {
				result.Errors.Add($"Assembly {entry.Name} has invalid format: {ex.Message}");
			}
			catch (Exception ex) {
				result.Errors.Add($"Error validating assembly {entry.Name}: {ex.Message}");
			}
		}

		return result.Errors.Count == 0;
	}

	private bool IsValidSemVer(string version) {
		// Basic semver validation (simplified)
		var parts = version.Split('.');
		if (parts.Length < 2 || parts.Length > 3) {
			return false;
		}

		foreach (var part in parts) {
			if (!int.TryParse(part, out _)) {
				return false;
			}
		}

		return true;
	}
}
