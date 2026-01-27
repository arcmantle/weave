using Microsoft.AspNetCore.Components;

namespace Pivot.Registry.Client.Services;

/// <summary>
/// HTTP message handler that intercepts 401 Unauthorized responses and redirects to login.
/// This ensures that if a user's session expires or auth cookie is lost, they are automatically logged out.
/// </summary>
public class AuthenticationHandler : DelegatingHandler
{
	private readonly NavigationManager _navigationManager;

	public AuthenticationHandler(NavigationManager navigationManager)
	{
		_navigationManager = navigationManager;
	}

	protected override async Task<HttpResponseMessage> SendAsync(
		HttpRequestMessage request,
		CancellationToken cancellationToken)
	{
		var response = await base.SendAsync(request, cancellationToken);

		// If we get a 401 Unauthorized, the session has expired or auth cookie is gone
		if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
		{
			// Don't redirect if we're already on the login page or calling auth endpoints
			var currentPath = _navigationManager.ToBaseRelativePath(_navigationManager.Uri);
			var isAuthEndpoint = request.RequestUri?.PathAndQuery.Contains("/api/auth") ?? false;

			if (!isAuthEndpoint && currentPath != "login")
			{
				// Redirect to login page with force reload to clear state
				_navigationManager.NavigateTo("/login", forceLoad: true);
			}
		}

		return response;
	}
}
