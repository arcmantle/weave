import { RouteHistory } from './route-history-base.js';


export class RouteHistoryUrl extends RouteHistory {

	/* should be run when the router historian is assigned to the router */
	connected(): void {
		window.addEventListener('popstate', () => {
			this.setRoute(this.getRoute());
		});
	}

	/* should be run when router itself is disconnected */
	disconnected(): void {

	}

	getRoute(): string {
		return location.pathname;
	}

	setRoute(route: string): string {
		history.pushState({}, '', route || './');
		window.dispatchEvent(new PopStateEvent('popstate'));

		return route;
	}

	appendHistory(_route: string): void {
	}

	clearHistory(): void {
	}

}
