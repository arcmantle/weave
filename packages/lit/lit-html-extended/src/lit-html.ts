/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
	boundAttributeSuffix,
	createMarker,
	DEV_MODE,
	ENABLE_EXTRA_SECURITY_HOOKS,
	HTML_RESULT,
	issueWarning,
	marker,
	markerMatch,
	MATHML_RESULT,
	type ResultType,
	SVG_RESULT,
} from './constants.ts';
import { debugLogEvent, debugLogRenderId } from './debug.ts';
import { resolveDirective } from './directive.ts';
import type { GlobalType } from './global-type.ts';
import { isIterable } from './helpers.ts';
import { AttributePart } from './parts/attribute-part.ts';
import { BooleanAttributePart } from './parts/boolean-part.ts';
import { ChildPart } from './parts/child-part.ts';
import { ElementPart } from './parts/element-part.ts';
import { EventPart } from './parts/event-part.ts';
import { getTemplateHtml } from './parts/part-helpers.ts';
import { PropertyPart } from './parts/property-part.ts';
import type { RootPart } from './parts/root-part.ts';
import { Template, TemplateInstance } from './parts/template.ts';
import type { RenderOptions, TemplateProducer, TemplateResult } from './parts/types.ts';
import { _clearSanitizerFactory, createSanitizer, setSanitizer } from './security.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


/**
 * Generates a template literal tag function that returns a TemplateResult with
 * the given result type.
 */
const tag = <T extends ResultType>(
	type: T,
) => (
	strings: TemplateStringsArray, ...values: unknown[]
): TemplateResult<T> => {
	// Warn against templates octal escape sequences
	// We do this here rather than in render so that the warning is closer to the
	// template definition.
	if (DEV_MODE.value && strings.some((s) => s === undefined)) {
		console.warn(''
			+ 'Some template strings are undefined.\n'
			+ 'This is probably caused by illegal octal escape sequences.');
	}

	if (DEV_MODE.value) {
		// Import static-html.js results in a circular dependency which g3 doesn't handle.
		// Instead we know that static values must have the field `_$litStatic$`.
		if (values.some(val => (val as { _$litStatic$: unknown; })?.['_$litStatic$'])) {
			issueWarning(
				'', ''
				+ `Static values 'literal' or 'unsafeStatic' cannot be used as values to non-static templates.\n`
				+ `Please use the static 'html' tag function. `
				+ `See https://lit.dev/docs/templates/expressions/#static-expressions`,
			);
		}
	}

	return {
		// This property needs to remain unminified.
		['_$litType$']: type,
		strings,
		values,
	};
};


/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 *
 * ```ts
 * const header = (title: string) => html`<h1>${title}</h1>`;
 * ```
 *
 * The `html` tag returns a description of the DOM to render as a value. It is
 * lazy, meaning no work is done until the template is rendered. When rendering,
 * if a template comes from the same expression as a previously rendered result,
 * it's efficiently updated instead of replaced.
 */
export const html: TemplateProducer = tag(HTML_RESULT);


/**
 * Interprets a template literal as an SVG fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const rect = svg`<rect width="10" height="10"></rect>`;
 *
 * const myImage = html`
 *   <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
 *     ${rect}
 *   </svg>`;
 * ```
 *
 * The `svg` *tag function* should only be used for SVG fragments, or elements
 * that would be contained **inside** an `<svg>` HTML element. A common error is
 * placing an `<svg>` *element* in a template tagged with the `svg` tag
 * function. The `<svg>` element is an HTML element and should be used within a
 * template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an SVG fragment from the
 * `render()` method, as the SVG fragment will be contained within the element's
 * shadow root and thus not be properly contained within an `<svg>` HTML
 * element.
 */
export const svg: TemplateProducer = tag(SVG_RESULT);


/**
 * Interprets a template literal as MathML fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const num = mathml`<mn>1</mn>`;
 *
 * const eq = html`
 *   <math>
 *     ${num}
 *   </math>`;
 * ```
 *
 * The `mathml` *tag function* should only be used for MathML fragments, or
 * elements that would be contained **inside** a `<math>` HTML element. A common
 * error is placing a `<math>` *element* in a template tagged with the `mathml`
 * tag function. The `<math>` element is an HTML element and should be used
 * within a template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an MathML fragment from the
 * `render()` method, as the MathML fragment will be contained within the
 * element's shadow root and thus not be properly contained within a `<math>`
 * HTML element.
 */
export const mathml: TemplateProducer = tag(MATHML_RESULT);


/**
 * END USERS SHOULD NOT RELY ON THIS OBJECT.
 *
 * Private exports for use by other Lit packages, not intended for use by
 * external users.
 *
 * We currently do not make a mangled rollup build of the lit-ssr code. In order
 * to keep a number of (otherwise private) top-level exports mangled in the
 * client side code, we export a _$LH object containing those members (or
 * helper methods for accessing private fields of those members), and then
 * re-export them for use in lit-ssr. This keeps lit-ssr agnostic to whether the
 * client-side code is being used in `dev` mode or `prod` mode.
 *
 * This has a unique name, to disambiguate it from private exports in
 * lit-element, which re-exports all of lit-html.
 *
 * @private
 */
export const _$LH = {
	// Used in lit-ssr
	_boundAttributeSuffix: boundAttributeSuffix,
	_marker:               marker,
	_markerMatch:          markerMatch,
	_HTML_RESULT:          HTML_RESULT,
	_getTemplateHtml:      getTemplateHtml,

	// Used in tests and private-ssr-support
	_TemplateInstance:     TemplateInstance,
	_isIterable:           isIterable,
	_resolveDirective:     resolveDirective,
	_ChildPart:            ChildPart,
	_AttributePart:        AttributePart,
	_BooleanAttributePart: BooleanAttributePart,
	_EventPart:            EventPart,
	_PropertyPart:         PropertyPart,
	_ElementPart:          ElementPart,
} as {};


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
