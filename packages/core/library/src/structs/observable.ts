import { nanoid } from '../dom/dom-id.ts';
import type { AsyncFn, Fn } from '../types/function.types.ts';


type Operation = 'add' | 'remove' | 'clear';


export class ObservableSet<V> extends Set<V> {

	protected observers: Map<string, Fn | AsyncFn> = new Map();

	protected react(value: { value?: V; }, operation: Operation): void {
		this.observers.forEach(val => val(value, operation, this));
	}

	/**
	 * Attaches a listener to the Observable, that will be called whenever state changes
	 */
	observe(fn: (value: any, operation: Operation, from: any) => void): {
		id:        string;
		unobserve: () => void;
	} {
		const _id = nanoid(10);
		this.observers.set(_id, fn);

		return { id: _id, unobserve: () => this.unobserve(_id) };
	}

	unobserve(id: string): void {
		this.observers.delete(id);
	}

	disconnect(): void {
		this.observers.clear();
	}

	override add(value: V): this {
		const res = super.add(value);
		this.react({ value }, 'add');

		return res;
	}

	override delete(value: V): boolean {
		const res = super.delete(value);
		this.react({ value }, 'remove');

		return res;
	}

	override clear(): void {
		super.clear();
		this.react({}, 'clear');
	}

}


export class ObservableMap<K, V> extends Map<K, V> {

	protected observers: Map<string, Fn | AsyncFn> = new Map();

	protected react(value: { key?: K; value?: V; }, operation: Operation): void {
		this.observers.forEach(val => val(value, operation, this));
	}

	/** Attaches a listener to the Observable, that will be called whenever state changes */
	observe(fn: (value: any, operation: Operation, from: any) => void): {
		id:        string;
		unobserve: () => void;
	} {
		const _id = nanoid(10);
		this.observers.set(_id, fn);

		return { id: _id, unobserve: () => this.unobserve(_id) };
	}

	unobserve(id: string): void {
		this.observers.delete(id);
	}

	disconnect(): void {
		this.observers.clear();
	}


	override set(key: K, value: V): this {
		const res = super.set(key, value);
		this.react({ key, value }, 'add');

		return res;
	}

	override delete(key: K): boolean {
		const res = super.delete(key);
		this.react({ key }, 'remove');

		return res;
	}

	override clear(): void {
		super.clear();
		this.react({}, 'clear');
	}

}
