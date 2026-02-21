export type CSSStyle = CSSStyleSheet | CSSStyleSheet[] | CSSStyle[];
export const css = (strings: TemplateStringsArray, ...values: any[]): EnhancedCSSStyleSheet => {
	const text = strings.reduce((acc, str, i) => {
		const value = values[i] ?? '';
		if (value instanceof EnhancedCSSStyleSheet)
			return acc + str + value.text;

		return acc + str + value;
	}, '');

	const stylesheet = new EnhancedCSSStyleSheet();
	stylesheet.replaceSync(text);

	return stylesheet;
};

export class EnhancedCSSStyleSheet extends CSSStyleSheet {

	text: string;

	override replaceSync(text: string): void {
		this.text = text;
		super.replaceSync(text);
	}

	override toString(): string {
		return this.text;
	}

}


const protoCache: WeakMap<object, object[]> = new WeakMap();

export const getPrototypeChain = <T extends object>(start: object): T[] => {
	const cached = protoCache.get(start);
	if (cached)
		return cached as T[];

	const chain: object[] = [ start ];
	let proto = Object.getPrototypeOf(start);
	while (proto && proto !== HTMLElement) {
		chain.unshift(proto);
		proto = Object.getPrototypeOf(proto);
	}

	protoCache.set(start, chain);

	return chain as T[];
};


const stylesCache: WeakMap<object[], CSSStyleSheet[]> = new WeakMap();

export const getInheritanceFlatStyles = <Cls extends Record<keyof any, any>>(
	styleKey: keyof Cls,
	ctor: Record<keyof any, any>,
): CSSStyleSheet[] => {
	const protoChain = getPrototypeChain<Cls>(ctor);

	const cached = stylesCache.get(protoChain);
	if (cached)
		return cached;

	const allStyles: (Cls[keyof Cls][] | Cls[keyof Cls])[] = [];
	for (const proto of protoChain) {
		if (proto[styleKey])
			allStyles.push(proto[styleKey]);
	}

	const flatStyles = flattenStyles(allStyles);
	stylesCache.set(protoChain, flatStyles);

	return flatStyles;
};


type NestedCSSStyleSheet = CSSStyleSheet[] | NestedCSSStyleSheet[];

export const flattenStyles = (styles: NestedCSSStyleSheet): CSSStyleSheet[] => {
	const flatStyles: Set<CSSStyleSheet> = new Set();

	for (const style of styles) {
		if (Array.isArray(style)) {
			const flat = style.flat() as CSSStyleSheet[];
			for (const style of flat)
				flatStyles.add(style);
		}
		else if (style) {
			flatStyles.add(style);
		}
	}

	return Array.from(flatStyles);
};
