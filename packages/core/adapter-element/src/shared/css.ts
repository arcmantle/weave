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


export const getFlatStyles = <StyleKey extends string>(
	styleKey: StyleKey,
	protoChain: Partial<Record<StyleKey, CSSStyle>>[],
): CSSStyleSheet[] => {
	const flatStyles: Set<CSSStyleSheet> = new Set();

	for (const proto of protoChain) {
		if (!proto[styleKey])
			continue;

		const styles = Array.isArray(proto[styleKey])
			? proto[styleKey]
			: [ proto[styleKey] ];

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
	}

	return Array.from(flatStyles);
};
