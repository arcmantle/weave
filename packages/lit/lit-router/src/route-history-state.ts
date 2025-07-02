import { RouteHistory } from './route-history-base.js';


export class RouteHistoryState extends RouteHistory {

	protected currentRoute = '';

	getRoute(): string {
		return this.currentRoute;
	}

	setRoute(route: string): string {
		this.currentRoute = route;
		this.appendHistory(route);

		return route;
	}

	appendHistory(route: string): void {
		this.history.push(route);
	}

	clearHistory(): void {
		this.history.length = 0;
	}

}
