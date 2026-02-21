using Microsoft.AspNetCore.Http;

namespace Pivot.Auth;


/// <summary>
/// Configuration options for Pivot authentication.
/// Bind from <c>Pivot:Auth</c> configuration section.
/// </summary>
public class PivotAuthOptions {
	/// <summary>
	/// HMAC-SHA256 key used to sign JWT access tokens.
	/// Must be at least 32 characters in production.
	/// </summary>
	public string JwtKey { get; set; } = "pivot-default-secret-key-change-in-production-min-32-chars";

	/// <summary>
	/// JWT issuer claim value.
	/// </summary>
	public string JwtIssuer { get; set; } = "Pivot";

	/// <summary>
	/// JWT audience claim value.
	/// </summary>
	public string JwtAudience { get; set; } = "PivotClient";

	/// <summary>
	/// Lifetime of JWT access tokens.
	/// </summary>
	public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(15);

	/// <summary>
	/// Lifetime of refresh tokens stored in the database.
	/// </summary>
	public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(30);

	/// <summary>
	/// SQLite connection string for the auth database that stores refresh tokens.
	/// </summary>
	public string ConnectionString { get; set; } = "Data Source=pivot-auth.db";

	/// <summary>
	/// Whether the Secure flag should be set on auth cookies.
	/// Disable in development when not using HTTPS.
	/// </summary>
	public bool CookieSecure { get; set; } = true;

	/// <summary>
	/// SameSite mode for auth cookies.
	/// </summary>
	public SameSiteMode CookieSameSite { get; set; } = SameSiteMode.Strict;
}
