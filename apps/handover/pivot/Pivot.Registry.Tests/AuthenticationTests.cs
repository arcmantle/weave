using Microsoft.Playwright;

namespace Pivot.Registry.Tests;

public class AuthenticationTests : IClassFixture<ServerFixture>, IAsyncLifetime {
	private readonly ServerFixture _serverFixture;
	private IPlaywright? _playwright;
	private IBrowser? _browser;
	private string BaseUrl => ServerFixture.BaseUrl;

	public AuthenticationTests(ServerFixture serverFixture) {
		_serverFixture = serverFixture;
	}

	public async Task InitializeAsync() {
		_playwright = await Playwright.CreateAsync();
		_browser = await _playwright.Chromium.LaunchAsync(new() {
			Headless = true
		});
	}

	public async Task DisposeAsync() {
		if (_browser != null)
			await _browser.DisposeAsync();
		_playwright?.Dispose();
	}

	[Fact]
	public async Task ShouldRedirectToLoginWhenNotAuthenticated() {
		var page = await _browser!.NewPageAsync();


		await page.GotoAsync(BaseUrl);

		// Give it a moment to process
		await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");
		await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Pivot Registry Login");
	}

	[Fact]
	public async Task ShouldLoginWithUsernameAndRedirect() {
		var page = await _browser!.NewPageAsync();
		await page.GotoAsync(BaseUrl);

		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");

		var usernameInput = page.Locator("input#username");
		await Assertions.Expect(usernameInput).ToBeVisibleAsync();
		await usernameInput.FillAsync("testuser");

		var loginButton = page.GetByRole(AriaRole.Button, new() { Name = "Login" });
		await loginButton.ClickAsync();

		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");
		await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Registry Manager");
	}

	[Fact]
	public async Task ShouldDisplayUsernameInSidebarAfterLogin() {
		var page = await _browser!.NewPageAsync();
		await page.GotoAsync($"{BaseUrl}/login");

		await page.Locator("input#username").FillAsync("john.doe");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();

		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");
		await Assertions.Expect(page.Locator(".header-bar")).ToContainTextAsync("john.doe");
	}

	[Fact]
	public async Task ShouldLogoutAndRedirectToLogin() {
		var page = await _browser!.NewPageAsync();

		// Login first
		await page.GotoAsync($"{BaseUrl}/login");
		await page.Locator("input#username").FillAsync("testuser");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");

		// Logout
		var logoutButton = page.GetByRole(AriaRole.Button, new() { NameRegex = new System.Text.RegularExpressions.Regex("Logout") });
		await Assertions.Expect(logoutButton).ToBeVisibleAsync();
		await logoutButton.ClickAsync();

		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");
	}

	[Fact]
	public async Task ShouldPersistAuthenticationAcrossReloads() {
		var page = await _browser!.NewPageAsync();

		// Login
		await page.GotoAsync($"{BaseUrl}/login");
		await page.Locator("input#username").FillAsync("persistuser");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");

		// Reload the page
		await page.ReloadAsync();

		// Should still be authenticated
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");
		await Assertions.Expect(page.Locator(".header-bar")).ToContainTextAsync("persistuser");
	}

	[Fact]
	public async Task ShouldShowErrorForEmptyUsername() {
		var page = await _browser!.NewPageAsync();
		await page.GotoAsync($"{BaseUrl}/login");

		// Click login without entering username
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();

		// Should show error
		await Assertions.Expect(page.Locator(".alert-danger")).ToContainTextAsync("Please enter a username");
		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");
	}

	[Fact]
	public async Task ShouldSupportEnterKeyForLogin() {
		var page = await _browser!.NewPageAsync();
		await page.GotoAsync($"{BaseUrl}/login");

		var usernameInput = page.Locator("input#username");
		await usernameInput.FillAsync("enteruser");
		await usernameInput.PressAsync("Enter");

		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");
	}

	[Fact]
	public async Task ShouldProtectRoutesAfterLogout() {
		var page = await _browser!.NewPageAsync();

		// Login
		await page.GotoAsync($"{BaseUrl}/login");
		await page.Locator("input#username").FillAsync("protecttest");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");

		// Logout
		await page.GetByRole(AriaRole.Button, new() { NameRegex = new System.Text.RegularExpressions.Regex("Logout") }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");

		// Try to navigate to home
		await page.GotoAsync(BaseUrl);

		// Should be redirected back to login
		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");
	}

	[Fact]
	public async Task ShouldSetHttpOnlyCookie() {
		var context = await _browser!.NewContextAsync();
		var page = await context.NewPageAsync();

		// Login
		await page.GotoAsync($"{BaseUrl}/login");
		await page.Locator("input#username").FillAsync("cookieuser");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");

		// Check cookies
		var cookies = await context.CookiesAsync();
		var accessCookie = cookies.FirstOrDefault(c => c.Name == "access_token");

		Assert.NotNull(accessCookie);
		Assert.True(accessCookie.HttpOnly);
		Assert.Equal("Strict", accessCookie.SameSite.ToString());
	}

	[Fact]
	public async Task ShouldRedirectToLoginWhenSessionExpires() {
		var context = await _browser!.NewContextAsync();
		var page = await context.NewPageAsync();

		// Login first
		await page.GotoAsync($"{BaseUrl}/login");
		await page.Locator("input#username").FillAsync("expiretest");
		await page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
		await Assertions.Expect(page).ToHaveURLAsync(BaseUrl + "/");

		// Clear the auth cookie to simulate session expiration
		await context.ClearCookiesAsync();

		// Navigate to the home page - should redirect to login because cookie is gone
		await page.GotoAsync(BaseUrl + "/");

		// Wait for the redirect and verify we're on the login page
		await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
		await Assertions.Expect(page).ToHaveURLAsync($"{BaseUrl}/login");
	}
}
