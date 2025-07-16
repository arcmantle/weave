/**
 * Encode and escape URLs to prevent breaking up rendered Markdown links.
 */
export const escapePromptURL = (url: string): string =>
	encodeURI(url).replace(/([\\()])/g, '\\$1');
