import type { stringliteral } from '../types/strings.types.js';


export class Phenomenon<T = any> {

	constructor(
		public type: string,
		public detail: T,
	) {}

}


class Beholder<TMap extends object> {

	#beholders: Map<string, Set<(phenom: Phenomenon) => any>> = new Map();

	add<K extends keyof TMap>(type: K, listener: (ev: TMap[K]) => any): void;
	add(type: stringliteral, listener: (ev: Phenomenon) => any): void;
	add(type: string, listener: (phenom: Phenomenon) => any): void {
		const set = this.#beholders.get(type) ?? (() => {
			const set: Set<(phenom: Phenomenon<any>) => any> = new Set();
			this.#beholders.set(type, set);

			return set;
		})();

		set.add(listener);
	}

	remove<K extends keyof TMap>(
		type: K, listener: (ev: TMap[K]) => any
	): void;
	remove(type: stringliteral, listener: (ev: Phenomenon) => any): void;
	remove(type: string, listener: (ev: Phenomenon) => any): void {
		this.#beholders.get(type)?.delete(listener);
	}

	dispatch(phenom: Phenomenon): void {
		this.#beholders.get(phenom.type)?.forEach(beholder => beholder(phenom));
	}

}


const beholder: Beholder<any> = new Beholder();


export const createAddBeholder = <T extends object>(): Beholder<T>['add'] => beholder.add;
export const createRemoveBeholder = <T extends object>(): Beholder<T>['remove'] => beholder.remove;
export const createDispatchPhenom = <T extends object>(): Beholder<T>['dispatch'] => beholder.dispatch;
