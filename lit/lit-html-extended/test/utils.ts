export const nextFrame = (): Promise<void> =>
	new Promise<any>((resolve) => requestAnimationFrame(resolve));


/**
 * Strips Lit expression comments from provided html string.
 */
export const stripExpressionComments = (html: string): string =>
	html.replace(/<!--\?lit\$[0-9]+\$-->|<!--\??-->/g, '');


/**
 * Strips Lit expression markers from provided html string.
 */
export const stripExpressionMarkers = (html: string): string =>
	html.replace(/<!--\?lit\$[0-9]+\$-->|<!--\??-->|lit\$[0-9]+\$/g, '');
