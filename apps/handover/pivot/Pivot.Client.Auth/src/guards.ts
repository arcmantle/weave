import type { Router } from '@arcmantle/pivot-client-router';
import type { AuthenticationService } from './auth-service.js';


/**
 * Creates a route guard that requires authentication.
 * Redirects to {@link loginPath} when unauthenticated.
 */
export function createAuthGuard(
	auth: AuthenticationService,
	routerInstance: Router,
	loginPath = '/login',
): () => Promise<boolean> {
	return async (): Promise<boolean> => {
		const isAuth = await auth.isAuthenticated();
		if (!isAuth) {
			await routerInstance.navigate(loginPath);

			return false;
		}

		return true;
	};
}
