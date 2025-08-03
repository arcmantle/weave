import type { TrustedHTML, TrustedTypePolicy } from 'trusted-types/lib';

import { DEV_MODE, ENABLE_EXTRA_SECURITY_HOOKS } from './constants.ts';
import type { GlobalType } from './global-type.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
export const policy: Pick<TrustedTypePolicy<{
	createHTML: (s: string) => string;
}>, 'name' | 'createHTML'> | undefined = global.trustedTypes
	? global.trustedTypes.createPolicy('lit-html', { createHTML: s => s })
	: undefined;


/**
 * Used to sanitize any value before it is written into the DOM. This can be
 * used to implement a security policy of allowed and disallowed values in
 * order to prevent XSS attacks.
 *
 * One way of using this callback would be to check attributes and properties
 * against a list of high risk fields, and require that values written to such
 * fields be instances of a class which is safe by construction. Closure's Safe
 * HTML Types is one implementation of this technique (
 * https://github.com/google/safe-html-types/blob/master/doc/safehtml-types.md).
 * The TrustedTypes polyfill in API-only mode could also be used as a basis
 * for this technique (https://github.com/WICG/trusted-types).
 *
 * @param node The HTML node (usually either a #text node or an Element) that
 *     is being written to. Note that this is just an exemplar node, the write
 *     may take place against another instance of the same class of node.
 * @param name The name of an attribute or property (for example, 'href').
 * @param type Indicates whether the write that's about to be performed will
 *     be to a property or a node.
 * @return A function that will sanitize this class of writes.
 */
export type SanitizerFactory = (
  node: Node,
  name: string,
  type: 'property' | 'attribute'
) => ValueSanitizer;


/**
 * A function which can sanitize values that will be written to a specific kind
 * of DOM sink.
 *
 * See SanitizerFactory.
 *
 * @param value The value to sanitize. Will be the actual value passed into
 *     the lit-html template literal, so this could be of any type.
 * @return The value to write to the DOM. Usually the same as the input value,
 *     unless sanitization is needed.
 */
export type ValueSanitizer = (value: unknown) => unknown;


const identityFunction: ValueSanitizer = (value: unknown) => value;
export const noopSanitizer: SanitizerFactory = (
	_node: Node,
	_name: string,
	_type: 'property' | 'attribute',
) => identityFunction;


/** Sets the global sanitizer factory. */
export const setSanitizer = (newSanitizer: SanitizerFactory): void => {
	if (!ENABLE_EXTRA_SECURITY_HOOKS.value)
		return;

	if (sanitizerFactoryInternal !== noopSanitizer) {
		throw new Error(
      `Attempted to overwrite existing lit-html security policy.` +
        ` setSanitizeDOMValueFactory should be called at most once.`,
		);
	}

	sanitizerFactoryInternal = newSanitizer;
};

/**
 * @important
 * Only used in internal tests, not a part of the public API.
 */
export const _clearSanitizerFactory = (): void => {
	sanitizerFactoryInternal = noopSanitizer;
};

export const createSanitizer: SanitizerFactory = (node, name, type) => {
	return sanitizerFactoryInternal(node, name, type);
};


export let sanitizerFactoryInternal: SanitizerFactory = noopSanitizer;


export function trustFromTemplateString(
	tsa: TemplateStringsArray,
	stringFromTSA: string,
): TrustedHTML {
	// A security check to prevent spoofing of Lit template results.
	// In the future, we may be able to replace this with Array.isTemplateObject,
	// though we might need to make that check inside of the html and svg
	// functions, because precompiled templates don't come in as
	// TemplateStringArray objects.
	if (!Array.isArray(tsa) || !tsa.hasOwnProperty('raw')) {
		let message = 'invalid template strings array';
		if (DEV_MODE.value) {
			message = ''
				+ `Internal Error: expected template strings to be an array\n`
				+ `with a 'raw' field. Faking a template strings array by\n`
				+ `calling html or svg like an ordinary function is effectively\n`
				+ `the same as calling unsafeHtml and can lead to major security\n`
				+ `issues, e.g. opening your code up to XSS attacks.\n`
				+ `If you're using the html or svg tagged template functions normally\n`
				+ `and still seeing this error, please file a bug at\n`
				+ `https://github.com/lit/lit/issues/new?template=bug_report.md\n`
				+ `and include information about your build tooling, if any.`
					.trim()
					.replace(/\n */g, '\n');
		}

		throw new Error(message);
	}

	return policy !== undefined
		? policy.createHTML(stringFromTSA)
		: (stringFromTSA as unknown as TrustedHTML);
}
