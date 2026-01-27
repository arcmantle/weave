using Microsoft.JSInterop;
using System.Net.Http.Json;

namespace Pivot.Registry.Client.Services;

public class AuthenticationService
{
	private readonly HttpClient _httpClient;
	private readonly IJSRuntime _jsRuntime;
	private string? _currentUser;

	public event Action? OnAuthenticationStateChanged;

	public AuthenticationService(HttpClient httpClient, IJSRuntime jsRuntime)
	{
		_httpClient = httpClient;
		_jsRuntime = jsRuntime;
	}

	public async Task<string?> GetCurrentUserAsync()
	{
		if (_currentUser == null)
		{
			try
			{
				// Check if authenticated by calling the server
				var response = await _httpClient.GetAsync("/api/auth/me");

				if (response.IsSuccessStatusCode)
				{
					var result = await response.Content.ReadFromJsonAsync<UserInfo>();
					_currentUser = result?.Username;
				}
				else
				{
					_currentUser = null;
				}
			}
			catch (Exception ex)
			{
				// Not authenticated
				Console.WriteLine($"[AuthService] Not authenticated (exception): {ex.Message}");
				_currentUser = null;
			}
		}
		return _currentUser;
	}

	public async Task<LoginResult> LoginAsync(string username)
	{
		if (string.IsNullOrWhiteSpace(username))
		{
			return new LoginResult { Success = false, Error = "Username cannot be empty" };
		}

		try
		{
			var response = await _httpClient.PostAsJsonAsync("/api/auth/login", new LoginRequest
			{
				Username = username
			});

			if (response.IsSuccessStatusCode)
			{
				var loginResponse = await response.Content.ReadFromJsonAsync<LoginResponse>();
				_currentUser = loginResponse?.Username;
				OnAuthenticationStateChanged?.Invoke();
				return new LoginResult { Success = true };
			}
			else
			{
				var error = await response.Content.ReadAsStringAsync();
				return new LoginResult { Success = false, Error = error };
			}
		}
		catch (Exception ex)
		{
			return new LoginResult { Success = false, Error = ex.Message };
		}
	}

	public async Task LogoutAsync()
	{
		try
		{
			await _httpClient.PostAsync("/api/auth/logout", null);
		}
		catch
		{
			// Ignore errors on logout
		}

		_currentUser = null;
		OnAuthenticationStateChanged?.Invoke();
	}

	public async Task<bool> IsAuthenticatedAsync()
	{
		var user = await GetCurrentUserAsync();
		return !string.IsNullOrWhiteSpace(user);
	}

	private class LoginRequest
	{
		public string Username { get; set; } = string.Empty;
	}

	private class LoginResponse
	{
		public string Token { get; set; } = string.Empty;
		public string Username { get; set; } = string.Empty;
		public DateTime ExpiresAt { get; set; }
	}

	private class UserInfo
	{
		public string Username { get; set; } = string.Empty;
	}
}

public class LoginResult
{
	public bool Success { get; set; }
	public string? Error { get; set; }
}
