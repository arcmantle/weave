import type { LoginRequest, LoginResponse, LoginResult, UserInfo } from '../models/auth.ts';

export class AuthenticationService {

	private currentUser:    string | null = null;
	private listeners:      Set<() => void> = new Set();
	private isRefreshing = false;
	private refreshPromise: Promise<boolean> | null = null;

	async getCurrentUser(): Promise<string | null> {
		if (this.currentUser === null) {
			try {
				const response = await fetch('/api/auth/me', {
					credentials: 'include',
				});

				if (response.ok) {
					const result: UserInfo = await response.json();
					this.currentUser = result.username;
				}
				else {
					this.currentUser = null;
				}
			}
			catch (err) {
				console.error('[AuthService] Not authenticated (exception):', err);
				this.currentUser = null;
			}
		}

		return this.currentUser;
	}

	async login(username: string): Promise<LoginResult> {
		if (!username.trim())
			return { success: false, error: 'Username cannot be empty' };


		try {
			const response = await fetch('/api/auth/login', {
				method:  'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body:        JSON.stringify({ username: username.trim() } as LoginRequest),
			});

			if (response.ok) {
				const loginResponse: LoginResponse = await response.json();
				this.currentUser = loginResponse.username;
				this.notifyListeners();

				return { success: true };
			}
			else {
				const error = await response.text();

				return { success: false, error };
			}
		}
		catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';

			return { success: false, error: message };
		}
	}

	async logout(): Promise<void> {
		try {
			await fetch('/api/auth/logout', {
				method:      'POST',
				credentials: 'include',
			});
		}
		catch {
			// Ignore errors on logout
		}

		this.currentUser = null;
		this.notifyListeners();
	}

	async isAuthenticated(): Promise<boolean> {
		const user = await this.getCurrentUser();

		return !!user;
	}

	onAuthenticationStateChanged(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	private notifyListeners(): void {
		this.listeners.forEach(listener => listener());
	}

	private async refreshToken(): Promise<boolean> {
		// Prevent concurrent refresh attempts
		if (this.isRefreshing) {
			// Wait for existing refresh to complete
			return this.refreshPromise ?? false;
		}

		this.isRefreshing = true;
		this.refreshPromise = this.performRefresh();

		try {
			return await this.refreshPromise;
		}
		finally {
			this.isRefreshing = false;
			this.refreshPromise = null;
		}
	}

	private async performRefresh(): Promise<boolean> {
		try {
			const response = await fetch('/api/auth/refresh', {
				method:      'POST',
				credentials: 'include',
			});

			if (response.ok) {
				const result: LoginResponse = await response.json();
				this.currentUser = result.username;
				this.notifyListeners();

				return true;
			}
			else {
				// Refresh failed - clear session
				this.currentUser = null;
				this.notifyListeners();

				return false;
			}
		}
		catch (err) {
			console.error('[AuthService] Token refresh failed:', err);
			this.currentUser = null;
			this.notifyListeners();

			return false;
		}
	}

	async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
		// Add credentials by default
		const fetchOptions: RequestInit = {
			...options,
			credentials: 'include',
		};

		// First attempt
		let response = await fetch(url, fetchOptions);

		// If 401, try to refresh token and retry once
		if (response.status === 401) {
			const refreshed = await this.refreshToken();

			if (refreshed) {
				// Retry the original request
				response = await fetch(url, fetchOptions);
			}
		}

		return response;
	}

}

export const authService: AuthenticationService = new AuthenticationService();
