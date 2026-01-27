using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.FileProviders;
using Pivot.Registry.Data;
using Pivot.Registry.Services;

namespace Pivot.Registry.Extensions;

public static class RegistryExtensions {
	/// <summary>
	/// Adds Pivot Registry services to the application
	/// </summary>
	public static WebApplicationBuilder AddPivotRegistry(
		this WebApplicationBuilder builder,
		Action<RegistryOptions>? configure = null) {

		var options = new RegistryOptions();
		builder.Configuration.GetSection("Pivot:Registry").Bind(options);
		configure?.Invoke(options);

		if (!options.Enabled) {
			return builder;
		}

		// Register options
		builder.Services.AddSingleton(options);

		// Configure database path
		var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
		var dbDirectory = Path.Combine(appDataPath, "Pivot", "Registries", options.ApplicationName);
		Directory.CreateDirectory(dbDirectory);
		var dbPath = Path.Combine(dbDirectory, "registry.db");

		var connectionString = options.ConnectionString ?? $"Data Source={dbPath}";

		// Add services
		builder.Services.AddDbContext<RegistryDbContext>(options =>
			options.UseSqlite(connectionString));

		builder.Services.AddControllers();
		builder.Services.AddEndpointsApiExplorer();
		builder.Services.AddSwaggerGen();

		// Add Blazor services
		builder.Services.AddRazorComponents()
			.AddInteractiveServerComponents();

		// Add CORS support
		builder.Services.AddCors(opts => {
			opts.AddDefaultPolicy(policy => {
				policy.AllowAnyOrigin()
					.AllowAnyMethod()
					.AllowAnyHeader();
			});
		});

		// Configure storage provider
		if (options.StorageProvider.Equals("MinIO", StringComparison.OrdinalIgnoreCase)) {
			builder.Services.Configure<MinioSettings>(opts => {
				opts.Endpoint = options.MinioEndpoint ?? "localhost:9000";
				opts.AccessKey = options.MinioAccessKey ?? "minioadmin";
				opts.SecretKey = options.MinioSecretKey ?? "minioadmin";
				opts.UseSsl = options.MinioUseSsl;
				opts.BucketName = options.MinioBucketName;
			});
			builder.Services.AddSingleton<IPluginStorage, MinioPluginStorage>();
		}
		else {
			// Use cross-platform app data directory for plugin packages
			var pluginPackagesPath = options.FileSystemBasePath
				?? Path.Combine(appDataPath, "Pivot", "Registries", options.ApplicationName, "packages");

			builder.Services.Configure<FileSystemStorageSettings>(opts => {
				opts.BasePath = pluginPackagesPath;
			});
			builder.Services.AddSingleton<IPluginStorage, FileSystemPluginStorage>();
		}

		builder.Services.AddScoped<PluginPackageService>();
		builder.Services.AddScoped<PluginValidationService>();

		return builder;
	}

	/// <summary>
	/// Maps Pivot Registry endpoints and initializes the database
	/// </summary>
	public static async Task<WebApplication> MapPivotRegistry(this WebApplication app) {
		var options = app.Services.GetService<RegistryOptions>();
		if (options == null || !options.Enabled) {
			return app;
		}

		// Ensure database is created
		using (var scope = app.Services.CreateScope()) {
			var db = scope.ServiceProvider.GetRequiredService<RegistryDbContext>();
			await db.Database.EnsureCreatedAsync();

			// Initialize storage
			var storage = scope.ServiceProvider.GetRequiredService<IPluginStorage>();
			await storage.InitializeAsync();
		}

		// Configure the HTTP request pipeline
		if (app.Environment.IsDevelopment()) {
			app.UseSwagger();
			app.UseSwaggerUI();
		}

		app.UseCors();
		app.UseSwagger();
		app.UseSwaggerUI();

		// Enable serving of static files including Blazor framework files
		// UseStaticFiles() should automatically include static web assets from NuGet packages
		app.UseStaticFiles();

		// Serve embedded static files from the library (custom CSS, etc.)
		var embeddedProvider = new ManifestEmbeddedFileProvider(
			typeof(RegistryExtensions).Assembly,
			"wwwroot"
		);

		app.UseStaticFiles(new StaticFileOptions {
			FileProvider = embeddedProvider,
			RequestPath = "" // Serve at root level
		});

		// Ensure antiforgery is set up before components
		app.UseAntiforgery();

		app.MapControllers();

		// Map Blazor components from the library
		app.MapRazorComponents<Components.App>()
			.AddInteractiveServerRenderMode();

		return app;
	}
}
