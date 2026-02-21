export class Getter<T = any> {

	static bind(getter: Getter, name: string, ref: Record<keyof any, any>): void {
		getter.#name = name;
		getter.#ref = new WeakRef(ref);
	}

	#name: string;
	#ref:  WeakRef<Record<keyof any, any>>;

	get value(): T {
		return this.#ref.deref()?.[this.#name];
	}

}
