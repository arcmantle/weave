const jsonStringify = (val: any) => {
	try {
		return JSON.stringify(val);
	}
	catch {
		return false;
	}
};

const jsonParse = <T>(str: string) => {
	try {
		return JSON.parse(str) as T;
	}
	catch {
		return false;
	}
};

const stringify = (val: any) => {
	if (typeof val === 'string')
		return val;

	return jsonStringify(val) || String(val);
};

const parse = (val: string) => {
	const parsed = jsonParse(val);
	if (parsed)
		return parsed;
	if (val === 'true')
		return true;
	if (val === 'false')
		return false;

	return val;
};


class LocalStorageHandler {

	protected storage: Storage = localStorage;

	constructor(storage: Storage) {
		this.storage = storage;
	}

	getItem<T>(key: string, value?: T): T {
		const existingValue = localStorage.getItem(key);
		existingValue ?? localStorage.setItem(key, stringify(value));

		return parse(localStorage.getItem(key)!) as T;
	}

	setItem<T>(key: string, value: T): T {
		localStorage.setItem(key, stringify(value));

		return parse(localStorage.getItem(key)!) as T;
	}

	removeItem(key: string): void {
		localStorage.removeItem(key);
	}

	clear(): void {
		localStorage.clear();
	}

}


export const storage: {
	local:   LocalStorageHandler;
	session: LocalStorageHandler;
} = {
	local:   new LocalStorageHandler(localStorage),
	session: new LocalStorageHandler(sessionStorage),
};
