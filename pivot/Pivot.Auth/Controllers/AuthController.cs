using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Pivot.Auth.Models;
using Pivot.Auth.Services;

namespace Pivot.Auth.Controllers;


[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase {

	protected readonly PivotAuthOptions _options;
	protected readonly JwtTokenService _jwtTokenService;
	protected readonly RefreshTokenService _refreshTokenService;
	protected readonly ILogger<AuthController> _logger;

	public AuthController(
		PivotAuthOptions options,
		JwtTokenService jwtTokenService,
		RefreshTokenService refreshTokenService,
		ILogger<AuthController> logger
	) {
		_options = options;
		_jwtTokenService = jwtTokenService;
		_refreshTokenService = refreshTokenService;
		_logger = logger;
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] LoginRequest request) {
		if (string.IsNullOrWhiteSpace(request.Username))
			return BadRequest(new { message = "Username is required" });

		var username = request.Username.Trim();

		// Generate access token
		var accessToken = _jwtTokenService.GenerateAccessToken(username);
		var accessTokenExpiry = DateTime.UtcNow.Add(_options.AccessTokenLifetime);

		// Generate and persist refresh token
		var refreshToken = await _refreshTokenService.CreateAsync(username);

		// Set HTTP-only cookies
		SetAuthCookies(accessToken, accessTokenExpiry, refreshToken.Token, refreshToken.ExpiresAt);

		return Ok(new LoginResponse {
			Token = accessToken,
			Username = username,
			ExpiresAt = accessTokenExpiry,
		});
	}

	[HttpPost("logout")]
	public async Task<IActionResult> Logout() {
		if (Request.Cookies.TryGetValue("refresh_token", out var refreshTokenValue))
			await _refreshTokenService.RevokeAsync(refreshTokenValue);

		Response.Cookies.Delete("access_token");
		Response.Cookies.Delete("refresh_token");

		return Ok(new { message = "Logged out successfully" });
	}

	[HttpPost("refresh")]
	public async Task<IActionResult> Refresh() {
		if (!Request.Cookies.TryGetValue("refresh_token", out var refreshTokenValue))
			return Unauthorized(new { message = "Refresh token not found" });

		var rotatedToken = await _refreshTokenService.ValidateAndRotateAsync(refreshTokenValue);
		if (rotatedToken == null)
			return Unauthorized(new { message = "Invalid or expired refresh token" });

		// Generate new access token
		var newAccessToken = _jwtTokenService.GenerateAccessToken(rotatedToken.Username);
		var accessTokenExpiry = DateTime.UtcNow.Add(_options.AccessTokenLifetime);

		// Set new cookies
		SetAuthCookies(newAccessToken, accessTokenExpiry, rotatedToken.Token, rotatedToken.ExpiresAt);

		return Ok(new LoginResponse {
			Token = newAccessToken,
			Username = rotatedToken.Username,
			ExpiresAt = accessTokenExpiry,
		});
	}

	[Authorize]
	[HttpGet("me")]
	public IActionResult GetCurrentUser() {
		var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
		if (string.IsNullOrEmpty(username))
			return Unauthorized();

		return Ok(new { username });
	}

	protected void SetAuthCookies(
		string accessToken,
		DateTime accessTokenExpiry,
		string refreshToken,
		DateTime refreshTokenExpiry
	) {
		Response.Cookies.Append("access_token", accessToken, new CookieOptions {
			HttpOnly = true,
			Secure = _options.CookieSecure,
			SameSite = _options.CookieSameSite,
			Expires = accessTokenExpiry,
		});

		Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions {
			HttpOnly = true,
			Secure = _options.CookieSecure,
			SameSite = _options.CookieSameSite,
			Expires = refreshTokenExpiry,
		});
	}

}
