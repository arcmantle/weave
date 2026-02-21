import { RouteHistory } from './route-history-base.js';
import { storageHandler } from './utilities/storageHandler.js';


export class RouteHistoryLocal extends RouteHistory {

	getRoute(): string {
		return storageHandler.getItem('currentRoute', '');
	}

	setRoute(route: string): string {
		storageHandler.setItem('currentRoute', route);
		this.appendHistory(route);

		return route;
	}

	appendHistory(route: string): void {
		const history = storageHandler.getItem<string[]>('routeHistory', []);
		history.push(route);

		storageHandler.setItem('routeHistory', history);
	}

	clearHistory(): void {
		this.history.length = 0;
	}

}
