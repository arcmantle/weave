using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Pivot.Auth.Services;


/// <summary>
/// Generates JWT access tokens using the configured <see cref="PivotAuthOptions"/>.
/// </summary>
public class JwtTokenService {

	protected readonly PivotAuthOptions _options;

	public JwtTokenService(PivotAuthOptions options) {
		_options = options;
	}

	/// <summary>
	/// Generate a signed JWT access token for the given username.
	/// </summary>
	public string GenerateAccessToken(string username) {
		var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.JwtKey));
		var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

		var claims = new[] {
			new Claim(ClaimTypes.Name, username),
			new Claim(JwtRegisteredClaimNames.Sub, username),
			new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
		};

		var token = new JwtSecurityToken(
			issuer: _options.JwtIssuer,
			audience: _options.JwtAudience,
			claims: claims,
			expires: DateTime.UtcNow.Add(_options.AccessTokenLifetime),
			signingCredentials: credentials
		);

		return new JwtSecurityTokenHandler().WriteToken(token);
	}

}
