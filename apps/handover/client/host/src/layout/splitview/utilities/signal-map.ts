import { signal } from '@preact/signals-core';


/**
 * A Map-like utility that automatically triggers signal updates when mutated.
 * This allows computed properties to automatically recompute when the map changes.
 *
 * Instead of manually creating new Map instances and updating signals,
 * this class handles the reactive updates internally.
 */
export class SignalMap<K, V> extends Map<K, V> {

	private _signal = signal(0);

	constructor(entries?: readonly (readonly [K, V])[] | null) {
		super(entries);
	}

	/**
	 * Get the current signal value - this creates a reactive dependency
	 * that will cause computed properties to recompute when the map changes
	 */
	get signal(): number {
		return this._signal.value;
	}

	/**
	 * Trigger a signal update to notify reactive dependencies
	 */
	private triggerUpdate(): void {
		this._signal.value = this._signal.value + 1;
	}

	// Override all mutating methods to trigger signal updates

	override set(key: K, value: V): this {
		const result = super.set(key, value);

		this.triggerUpdate();

		return result;
	}

	override delete(key: K): boolean {
		const result = super.delete(key);
		if (result)
			this.triggerUpdate();

		return result;
	}

	override clear(): void {
		if (this.size > 0) {
			super.clear();
			this.triggerUpdate();
		}
	}

	// Override read methods to ensure reactive dependencies are created
	// by accessing the signal value

	override get(key: K): V | undefined {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.get(key);
	}

	override has(key: K): boolean {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.has(key);
	}

	override values(): MapIterator<V> {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.values();
	}

	override keys(): MapIterator<K> {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.keys();
	}

	override entries(): MapIterator<[K, V]> {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.entries();
	}

	override forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
		// Access signal to create reactive dependency
		this._signal.value;
		super.forEach(callbackfn, thisArg);
	}

	override get size(): number {
		// Access signal to create reactive dependency
		this._signal.value;

		return super.size;
	}

	override [Symbol.iterator](): MapIterator<[K, V]> {
		// Access signal to create reactive dependency
		this._signal.value;

		return super[Symbol.iterator]();
	}

}
