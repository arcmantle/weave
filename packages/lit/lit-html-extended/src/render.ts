import { createMarker, DEV_MODE, ENABLE_EXTRA_SECURITY_HOOKS, issueWarning } from './constants.ts';
import { debugLogEvent, debugLogRenderId } from './debug.ts';
import type { GlobalType } from './global-type.ts';
import { ChildPart } from './internal.ts';
import type { RootPart } from './parts/root-part.ts';
import { Template } from './parts/template.ts';
import type { RenderOptions } from './parts/types.ts';
import { _clearSanitizerFactory, createSanitizer, setSanitizer } from './security.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


// Apply polyfills if available
const polyfillSupport = DEV_MODE.value
	? global.litHtmlPolyfillSupportDevMode
	: global.litHtmlPolyfillSupport;

polyfillSupport?.(Template, ChildPart);

// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
(global.litHtmlVersions ??= []).push('3.3.1');
if (DEV_MODE.value && global.litHtmlVersions.length > 1) {
	queueMicrotask(() => {
		issueWarning(
			'multiple-versions',
			`Multiple versions of Lit loaded. ` +
			`Loading multiple versions is not recommended.`,
		);
	});
}


/**
 * Renders a value, usually a lit-html TemplateResult, to the container.
 *
 * This example renders the text "Hello, Zoe!" inside a paragraph tag, appending
 * it to the container `document.body`.
 *
 * ```js
 * import {html, render} from 'lit';
 *
 * const name = "Zoe";
 * render(html`<p>Hello, ${name}!</p>`, document.body);
 * ```
 *
 * @param value Any [renderable
 *   value](https://lit.dev/docs/templates/expressions/#child-expressions),
 *   typically a {@linkcode TemplateResult} created by evaluating a template tag
 *   like {@linkcode html} or {@linkcode svg}.
 * @param container A DOM container to render to. The first render will append
 *   the rendered value to the container, and subsequent renders will
 *   efficiently update the rendered value if the same result type was
 *   previously rendered there.
 * @param options See {@linkcode RenderOptions} for options documentation.
 * @see
 * {@link https://lit.dev/docs/libraries/standalone-templates/#rendering-lit-html-templates| Rendering Lit HTML Templates}
 */
export const render = (
	value: unknown,
	container: HTMLElement | DocumentFragment,
	options?: RenderOptions,
): RootPart => {
	if (DEV_MODE.value && container == null) {
		// Give a clearer error message than
		//     Uncaught TypeError: Cannot read properties of null (reading
		//     '_$litPart$')
		// which reads like an internal Lit error.
		throw new TypeError(`The container to render into may not be ${ container }`);
	}

	const renderId = DEV_MODE.value ? debugLogRenderId.value++ : 0;
	const partOwnerNode = options?.renderBefore ?? container;

	// This property needs to remain unminified.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let part: ChildPart = (partOwnerNode as any)['_$litPart$'];

	debugLogEvent?.({
		kind: 'begin render',
		id:   renderId,
		value,
		container,
		options,
		part,
	});

	if (part === undefined) {
		const endNode = options?.renderBefore ?? null;

		// This property needs to remain unminified.
		(partOwnerNode as any)['_$litPart$'] = part = new ChildPart(
			container.insertBefore(createMarker(), endNode),
			endNode,
			undefined,
			options ?? {},
		);
	}

	part._$setValue(value);

	debugLogEvent?.({
		kind: 'end render',
		id:   renderId,
		value,
		container,
		options,
		part,
	});

	return part as RootPart;
};


if (ENABLE_EXTRA_SECURITY_HOOKS.value) {
	const _render = render as typeof render & {
		setSanitizer:           typeof setSanitizer;
		createSanitizer:        typeof createSanitizer;
		_clearSanitizerFactory: typeof _clearSanitizerFactory;
	};

	_render.setSanitizer = setSanitizer;
	_render.createSanitizer = createSanitizer;

	if (DEV_MODE.value)
		_render._clearSanitizerFactory = _clearSanitizerFactory;
}
