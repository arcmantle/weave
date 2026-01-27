using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Pivot.Registry.Data;
using Pivot.Registry.Services;
using System.Text;

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

		// Configure JWT authentication
		var jwtKey = builder.Configuration["Jwt:Key"] ?? "pivot-registry-super-secret-key-change-in-production-min-32-chars";
		var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "PivotRegistry";
		var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "PivotRegistryClient";

		builder.Services.AddAuthentication(options =>
		{
			options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
			options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
		})
		.AddJwtBearer(options =>
		{
			options.TokenValidationParameters = new TokenValidationParameters
			{
				ValidateIssuer = true,
				ValidateAudience = true,
				ValidateLifetime = true,
				ValidateIssuerSigningKey = true,
				ValidIssuer = jwtIssuer,
				ValidAudience = jwtAudience,
				IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
			};

			// Support token from cookie
			options.Events = new JwtBearerEvents
			{
				OnMessageReceived = context =>
				{
					if (context.Request.Cookies.ContainsKey("auth_token"))
					{
						context.Token = context.Request.Cookies["auth_token"];
					}
					return Task.CompletedTask;
				}
			};
		});

		builder.Services.AddAuthorization();

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

		app.UseAuthentication();
		app.UseAuthorization();

		// Enable development-time static web assets
		if (app.Environment.IsDevelopment()) {
			app.UseWebAssemblyDebugging();
		}

		// Serve Blazor WebAssembly framework files and static assets from the client project
		app.UseBlazorFrameworkFiles();
		app.UseStaticFiles();

		app.MapControllers();

		// Fallback to index.html for client-side routing
		app.MapFallbackToFile("/index.html");

		return app;
	}
}
