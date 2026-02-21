using Microsoft.EntityFrameworkCore;
using Pivot.Auth.Data;
using Pivot.Auth.Models;

namespace Pivot.Auth.Services;


/// <summary>
/// Manages refresh token lifecycle: creation, validation with rotation, and revocation.
/// </summary>
public class RefreshTokenService {

	protected readonly AuthDbContext _dbContext;
	protected readonly PivotAuthOptions _options;

	public RefreshTokenService(AuthDbContext dbContext, PivotAuthOptions options) {
		_dbContext = dbContext;
		_options = options;
	}

	/// <summary>
	/// Create a new refresh token for the given username and persist it.
	/// </summary>
	public async Task<RefreshToken> CreateAsync(string username) {
		var refreshToken = new RefreshToken {
			Username = username,
			Token = Guid.NewGuid().ToString(),
			ExpiresAt = DateTime.UtcNow.Add(_options.RefreshTokenLifetime),
			CreatedAt = DateTime.UtcNow,
		};

		_dbContext.RefreshTokens.Add(refreshToken);
		await _dbContext.SaveChangesAsync();

		return refreshToken;
	}

	/// <summary>
	/// Validate an existing refresh token and rotate it.
	/// Returns <c>null</c> if the token is invalid or expired.
	/// </summary>
	public async Task<RefreshToken?> ValidateAndRotateAsync(string tokenValue) {
		var existing = await _dbContext.RefreshTokens
			.FirstOrDefaultAsync(t => t.Token == tokenValue);

		if (existing == null || !existing.IsActive)
			return null;

		// Revoke old token
		existing.RevokedAt = DateTime.UtcNow;

		// Create rotated token
		var rotated = new RefreshToken {
			Username = existing.Username,
			Token = Guid.NewGuid().ToString(),
			ExpiresAt = DateTime.UtcNow.Add(_options.RefreshTokenLifetime),
			CreatedAt = DateTime.UtcNow,
		};

		_dbContext.RefreshTokens.Add(rotated);
		await _dbContext.SaveChangesAsync();

		return rotated;
	}

	/// <summary>
	/// Revoke a refresh token by its value.
	/// </summary>
	public async Task RevokeAsync(string tokenValue) {
		var token = await _dbContext.RefreshTokens
			.FirstOrDefaultAsync(t => t.Token == tokenValue && t.RevokedAt == null);

		if (token != null) {
			token.RevokedAt = DateTime.UtcNow;
			await _dbContext.SaveChangesAsync();
		}
	}

}
