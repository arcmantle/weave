export const getPrototypeChain = <T extends object>(start: object): T[] => {
	const chain: object[] = [ start ];
	let proto = Object.getPrototypeOf(start);
	while (proto && proto !== HTMLElement) {
		chain.unshift(proto);
		proto = Object.getPrototypeOf(proto);
	}

	return chain as T[];
};
