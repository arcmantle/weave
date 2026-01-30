using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pivot.Registry.Data;
using Pivot.Registry.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Pivot.Registry.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase {
	private readonly IConfiguration _configuration;
	private readonly ILogger<AuthController> _logger;
	private readonly RegistryDbContext _dbContext;

	public AuthController(IConfiguration configuration, ILogger<AuthController> logger, RegistryDbContext dbContext) {
		_configuration = configuration;
		_logger = logger;
		_dbContext = dbContext;
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] LoginRequest request) {
		if (string.IsNullOrWhiteSpace(request.Username)) {
			return BadRequest(new { message = "Username is required" });
		}

		// For demo: any username is valid
		// In production, you'd validate against a user store
		var username = request.Username.Trim();

		// Generate short-lived access token (15 minutes)
		var accessToken = GenerateJwtToken(username, TimeSpan.FromMinutes(15));
		var accessTokenExpiry = DateTime.UtcNow.AddMinutes(15);

		// Generate refresh token (30 days)
		var refreshToken = new RefreshToken {
			Username = username,
			Token = Guid.NewGuid().ToString(),
			ExpiresAt = DateTime.UtcNow.AddDays(30),
			CreatedAt = DateTime.UtcNow
		};

		// Store refresh token in database
		_dbContext.RefreshTokens.Add(refreshToken);
		await _dbContext.SaveChangesAsync();

		// Set HTTP-only cookies
		Response.Cookies.Append("access_token", accessToken, new CookieOptions {
			HttpOnly = true,
			Secure = true,
			SameSite = SameSiteMode.Strict,
			Expires = accessTokenExpiry
		});

		Response.Cookies.Append("refresh_token", refreshToken.Token, new CookieOptions {
			HttpOnly = true,
			Secure = true,
			SameSite = SameSiteMode.Strict,
			Expires = refreshToken.ExpiresAt
		});

		return Ok(new LoginResponse {
			Token = accessToken,
			Username = username,
			ExpiresAt = accessTokenExpiry
		});
	}

	[HttpPost("logout")]
	public async Task<IActionResult> Logout() {
		// Get refresh token from cookie
		if (Request.Cookies.TryGetValue("refresh_token", out var refreshTokenValue)) {
			// Revoke the refresh token in database
			var token = await _dbContext.RefreshTokens
				 .FirstOrDefaultAsync(t => t.Token == refreshTokenValue && t.RevokedAt == null);

			if (token != null) {
				token.RevokedAt = DateTime.UtcNow;
				await _dbContext.SaveChangesAsync();
			}
		}

		// Delete cookies
		Response.Cookies.Delete("access_token");
		Response.Cookies.Delete("refresh_token");

		return Ok(new { message = "Logged out successfully" });
	}

	[HttpPost("refresh")]
	public async Task<IActionResult> Refresh() {
		// Get refresh token from cookie
		if (!Request.Cookies.TryGetValue("refresh_token", out var refreshTokenValue)) {
			return Unauthorized(new { message = "Refresh token not found" });
		}

		// Validate refresh token from database
		var refreshToken = await _dbContext.RefreshTokens
			 .FirstOrDefaultAsync(t => t.Token == refreshTokenValue);

		if (refreshToken == null || !refreshToken.IsActive) {
			return Unauthorized(new { message = "Invalid or expired refresh token" });
		}

		// Generate new access token
		var newAccessToken = GenerateJwtToken(refreshToken.Username, TimeSpan.FromMinutes(15));
		var accessTokenExpiry = DateTime.UtcNow.AddMinutes(15);

		// Generate new refresh token (token rotation)
		var newRefreshToken = new RefreshToken {
			Username = refreshToken.Username,
			Token = Guid.NewGuid().ToString(),
			ExpiresAt = DateTime.UtcNow.AddDays(30),
			CreatedAt = DateTime.UtcNow
		};

		// Revoke old refresh token
		refreshToken.RevokedAt = DateTime.UtcNow;

		// Store new refresh token
		_dbContext.RefreshTokens.Add(newRefreshToken);
		await _dbContext.SaveChangesAsync();

		// Set new cookies
		Response.Cookies.Append("access_token", newAccessToken, new CookieOptions {
			HttpOnly = true,
			Secure = true,
			SameSite = SameSiteMode.Strict,
			Expires = accessTokenExpiry
		});

		Response.Cookies.Append("refresh_token", newRefreshToken.Token, new CookieOptions {
			HttpOnly = true,
			Secure = true,
			SameSite = SameSiteMode.Strict,
			Expires = newRefreshToken.ExpiresAt
		});

		return Ok(new LoginResponse {
			Token = newAccessToken,
			Username = refreshToken.Username,
			ExpiresAt = accessTokenExpiry
		});
	}

	[Authorize]
	[HttpGet("me")]
	public IActionResult GetCurrentUser() {
		var username = User.FindFirst(ClaimTypes.Name)?.Value;
		if (string.IsNullOrEmpty(username)) {
			return Unauthorized();
		}

		return Ok(new { username });
	}

	private string GenerateJwtToken(string username, TimeSpan? expiration = null) {
		var jwtKey = _configuration["Jwt:Key"] ?? "pivot-registry-super-secret-key-change-in-production-min-32-chars";
		var jwtIssuer = _configuration["Jwt:Issuer"] ?? "PivotRegistry";
		var jwtAudience = _configuration["Jwt:Audience"] ?? "PivotRegistryClient";

		var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
		var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

		var claims = new[]
		{
				new Claim(ClaimTypes.Name, username),
				new Claim(JwtRegisteredClaimNames.Sub, username),
				new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
		  };

		var expiresAt = expiration.HasValue
			 ? DateTime.UtcNow.Add(expiration.Value)
			 : DateTime.UtcNow.AddHours(24);

		var token = new JwtSecurityToken(
			 issuer: jwtIssuer,
			 audience: jwtAudience,
			 claims: claims,
			 expires: expiresAt,
			 signingCredentials: credentials
		);

		return new JwtSecurityTokenHandler().WriteToken(token);
	}
}
