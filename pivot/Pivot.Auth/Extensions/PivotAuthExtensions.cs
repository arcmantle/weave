using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Pivot.Auth.Data;
using Pivot.Auth.Services;
using System.Text;

namespace Pivot.Auth.Extensions;


public static class PivotAuthExtensions {

	/// <summary>
	/// Adds Pivot authentication services: JWT bearer auth, refresh token DB,
	/// token services, and the <c>AuthController</c>.
	/// Reads defaults from <c>Pivot:Auth</c> configuration section.
	/// </summary>
	public static WebApplicationBuilder AddPivotAuth(
		this WebApplicationBuilder builder,
		Action<PivotAuthOptions>? configure = null
	) {
		var options = new PivotAuthOptions();
		builder.Configuration.GetSection("Pivot:Auth").Bind(options);
		configure?.Invoke(options);

		// Register options as singleton
		builder.Services.AddSingleton(options);

		// Register auth database context
		builder.Services.AddDbContext<AuthDbContext>(dbOpts =>
			dbOpts.UseSqlite(options.ConnectionString));

		// Register token services
		builder.Services.AddScoped<JwtTokenService>();
		builder.Services.AddScoped<RefreshTokenService>();

		// Add controllers from this assembly so AuthController is discovered
		builder.Services.AddControllers()
			.AddApplicationPart(typeof(PivotAuthExtensions).Assembly);

		// Configure JWT Bearer authentication
		builder.Services.AddAuthentication(authOpts => {
			authOpts.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
			authOpts.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
		})
		.AddJwtBearer(jwtOpts => {
			jwtOpts.TokenValidationParameters = new TokenValidationParameters {
				ValidateIssuer = true,
				ValidateAudience = true,
				ValidateLifetime = true,
				ValidateIssuerSigningKey = true,
				ValidIssuer = options.JwtIssuer,
				ValidAudience = options.JwtAudience,
				IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.JwtKey)),
			};

			// Read JWT from cookie when present
			jwtOpts.Events = new JwtBearerEvents {
				OnMessageReceived = context => {
					if (context.Request.Cookies.ContainsKey("access_token"))
						context.Token = context.Request.Cookies["access_token"];

					return Task.CompletedTask;
				},
			};
		});

		// Add base authorization policies
		builder.Services.AddAuthorization(authzOpts => {
			authzOpts.AddPolicy("PivotWrite", policy =>
				policy.RequireAuthenticatedUser());

			authzOpts.AddPolicy("PivotRead", policy =>
				policy.RequireAuthenticatedUser());
		});

		return builder;
	}

	/// <summary>
	/// Maps Pivot authentication middleware and ensures the auth database is created.
	/// Call this <b>before</b> mapping application-specific endpoints.
	/// </summary>
	public static async Task<WebApplication> MapPivotAuth(this WebApplication app) {
		// Ensure auth database is created
		using (var scope = app.Services.CreateScope()) {
			var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
			await db.Database.EnsureCreatedAsync();
		}

		app.UseAuthentication();
		app.UseAuthorization();

		return app;
	}

}
