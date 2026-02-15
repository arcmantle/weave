using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Pivot.Auth.Extensions;
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

		// Also try root-level AccessMode for self-hosting scenarios
		var rootAccessMode = builder.Configuration["AccessMode"];
		if (!string.IsNullOrEmpty(rootAccessMode)
			&& Enum.TryParse<RegistryAccessMode>(rootAccessMode, ignoreCase: true, out var accessMode)) {
			options.AccessMode = accessMode;
		}

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

		// Configure authentication via Pivot.Auth
		builder.AddPivotAuth(authOpts => {
			// Use the same database directory for auth
			var authDbPath = Path.Combine(dbDirectory, "auth.db");
			authOpts.ConnectionString = $"Data Source={authDbPath}";
		});

		// Override PivotRead policy based on Registry access mode
		builder.Services.AddAuthorization(authzOpts => {
			// Write operations always require authentication
			authzOpts.AddPolicy("RegistryWrite", policy =>
				policy.RequireAuthenticatedUser());

			// Read operations are conditional on the access mode
			authzOpts.AddPolicy("RegistryRead", policy => {
				if (options.AccessMode == RegistryAccessMode.Public) {
					// In public mode anyone can read
					policy.RequireAssertion(_ => true);
				}
				else {
					policy.RequireAuthenticatedUser();
				}
			});
		});

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

		// Initialize auth middleware and database
		await app.MapPivotAuth();

		// Enable development-time static web assets
		if (app.Environment.IsDevelopment()) {
			app.UseSwagger();
			app.UseSwaggerUI();
		}

		// Serve static files from wwwroot (client build output)
		app.UseStaticFiles();

		app.MapControllers();

		// Login page is always accessible (separate entry point)
		app.MapFallbackToFile("/login/{**path}", "login/index.html");

		// Main SPA fallback: redirect unauthenticated users to /login in Private mode
		app.MapFallback(async context => {
			if (options.AccessMode == RegistryAccessMode.Private
				&& context.User.Identity?.IsAuthenticated != true) {
				context.Response.Redirect("/login");
				return;
			}

			// Serve index.html for client-side routing
			var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
			var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
			var filePath = Path.Combine(webRoot, "index.html");

			if (!File.Exists(filePath)) {
				context.Response.StatusCode = 404;
				return;
			}

			context.Response.ContentType = "text/html";
			await context.Response.SendFileAsync(filePath);
		});

		return app;
	}
}
