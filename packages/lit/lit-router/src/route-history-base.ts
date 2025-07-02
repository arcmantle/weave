export abstract class RouteHistory {

	protected history: string[] = [];
	abstract getRoute(): string;
	abstract setRoute(route: string): string;
	abstract appendHistory(route: string): void;
	abstract clearHistory(): void;

}
