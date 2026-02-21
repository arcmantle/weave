using Pivot.Registry.Extensions;
using Pivot.Registry.Services;


var builder = WebApplication.CreateBuilder(args);

// Add Pivot Registry services (includes Lit-based client)
builder.AddPivotRegistry(options => {
	options.Enabled = true;
	options.ApplicationName = "RegistryExample";
	options.StorageProvider = "FileSystem";
});

var app = builder.Build();

// Initialize and map Pivot Registry (includes Lit client and API)
await app.MapPivotRegistry();

// Seed sample plugins from the Plugins/packages directory
await SeedSamplePluginsAsync(app);

app.Run();


static async Task SeedSamplePluginsAsync(WebApplication app) {
	var packagesDir = Path.Combine(app.Environment.ContentRootPath, "..", "Plugins", "packages");
	packagesDir = Path.GetFullPath(packagesDir);

	if (!Directory.Exists(packagesDir)) {
		app.Logger.LogWarning("Sample plugins directory not found: {Path}", packagesDir);
		return;
	}

	var packageFiles = Directory.GetFiles(packagesDir, "*.pivotpkg");
	if (packageFiles.Length == 0) {
		app.Logger.LogInformation("No sample plugin packages found in {Path}", packagesDir);
		return;
	}

	using var scope = app.Services.CreateScope();
	var packageService = scope.ServiceProvider.GetRequiredService<PluginPackageService>();

	foreach (var packageFile in packageFiles) {
		var fileName = Path.GetFileName(packageFile);

		try {
			await using var stream = File.OpenRead(packageFile);
			var (success, error, _) = await packageService.UploadPackageAsync(stream);

			if (success) {
				app.Logger.LogInformation("Seeded sample plugin: {FileName}", fileName);
			}
			else if (error?.Contains("already exists", StringComparison.OrdinalIgnoreCase) == true) {
				app.Logger.LogDebug("Sample plugin already seeded: {FileName}", fileName);
			}
			else {
				app.Logger.LogWarning("Failed to seed plugin {FileName}: {Error}", fileName, error);
			}
		}
		catch (Exception ex) {
			app.Logger.LogError(ex, "Error seeding plugin {FileName}", fileName);
		}
	}
}
