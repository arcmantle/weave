function observe<T extends object>(object: T): T {
	const original = structuredClone(object);

	const proxy = new Proxy(object, {
		get(target, prop) {
			const result = Reflect.get(target, prop);

			return result;
		},
		set(target, prop, value) {
			const result = Reflect.set(target, prop, value);

			return result;
		},
	});


	return proxy as T;
}
