import type { GlobalType } from './global-type.ts';
import type { Template } from './parts/template.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


export const DEV_MODE = { value: true };
export const ENABLE_EXTRA_SECURITY_HOOKS = { value: true };
export const ENABLE_SHADYDOM_NOPATCH = { value: true };
export const NODE_MODE = { value: false };


// Added to an attribute name to mark the attribute as bound so we can find it easily.
export const boundAttributeSuffix = '$lit$';

// This marker is used in many syntactic positions in HTML, so it must be
// a valid element name and attribute name. We don't support dynamic names (yet)
// but this at least ensures that the parse tree is closer to the template
// intention.
export const marker: string = `lit$${ Math.random().toFixed(9).slice(2) }$`;


// String used to tell if a comment is a marker comment
export const markerMatch: string = '?' + marker;


// Text used to insert a comment marker node. We use processing instruction
// syntax because it's slightly smaller, but parses as a comment node.
export const nodeMarker: string = `<${ markerMatch }>`;


export const SPACE_CHAR = `[ \t\n\f\r]`;
export const ATTR_VALUE_CHAR = `[^ \t\n\f\r"'\`<>=]`;
export const NAME_CHAR = `[^\\s"'>=/]`;


// #region parsing regexes

/*
	These regexes represent the five parsing states that we care about in the
	Template's HTML scanner. They match the *end* of the state they're named
	after.
	Depending on the match, we transition to a new state. If there's no match,
	we stay in the same state.
	Note that the regexes are stateful. We utilize lastIndex and sync it
	across the multiple regexes used. In addition to the five regexes below
	we also dynamically create a regex to find the matching end tags for raw
	text elements.
*/

/**
 * End of text is: `<` followed by: (comment start) or (tag) or (dynamic tag binding)
 */
export const textEndRegex: RegExp = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
export const COMMENT_START = 1;
export const TAG_NAME = 2;
export const DYNAMIC_TAG_NAME = 3;

export const commentEndRegex: RegExp = /-->/g;

/**
 * Comments not started with <!--, like </{, can be ended by a single `>`
 */
export const comment2EndRegex: RegExp = />/g;

/**
 * The tagEnd regex matches the end of the "inside an opening" tag syntax
 * position. It either matches a `>`, an attribute-like sequence, or the end
 * of the string after a space (attribute-name position ending).
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \t\n\f\r" are HTML space characters:
 * https://infra.spec.whatwg.org/#ascii-whitespace
 *
 * So an attribute is:
 *  * The name: any character except a whitespace character, ("), ('), ">",
 *    "=", or "/". Note: this is different from the HTML spec which also excludes control characters.
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
export const tagEndRegex: RegExp = new RegExp(
  `>|${ SPACE_CHAR }(?:(${ NAME_CHAR }+)(${ SPACE_CHAR }*=${ SPACE_CHAR }*(?:${ ATTR_VALUE_CHAR }|("|')|))|$)`,
  'g',
);
export const ENTIRE_MATCH = 0;
export const ATTRIBUTE_NAME = 1;
export const SPACES_AND_EQUALS = 2;
export const QUOTE_CHAR = 3;

export const singleQuoteAttrEndRegex: RegExp = /'/g;
export const doubleQuoteAttrEndRegex: RegExp = /"/g;

/**
 * Matches the raw text elements.
 *
 * Comments are not parsed within raw text elements, so we need to search their
 * text content for marker strings.
 */
export const rawTextElement: RegExp = /^(?:script|style|textarea|title)$/i;
//#endregion


export const doc: Document = NODE_MODE && global.document === undefined
	? ({ createTreeWalker() { return {}; } } as unknown as Document)
	: document;


// Creates a dynamic marker. We never have to search for these in the DOM.
export const createMarker = (): Comment => doc.createComment('');


export const walker: TreeWalker = doc
	.createTreeWalker(doc, 129 /* NodeFilter.SHOW_{ELEMENT|COMMENT} */);


/** TemplateResult types */
export type HTMLResult = typeof HTML_RESULT;
export const HTML_RESULT = 1;

export type SVGResult = typeof SVG_RESULT;
export const SVG_RESULT = 2;

export type MATHMLResult = typeof MATHML_RESULT;
export const MATHML_RESULT = 3;

export type ResultType = typeof HTML_RESULT | typeof SVG_RESULT | typeof MATHML_RESULT;


// TemplatePart types
// IMPORTANT: these must match the values in PartType
export type AttributePartType = typeof ATTRIBUTE_PART;
export const ATTRIBUTE_PART = 1;

export type ChildPartType = typeof CHILD_PART;
export const CHILD_PART = 2;

export type PropertyPartType = typeof PROPERTY_PART;
export const PROPERTY_PART = 3;

export type BooleanPartType = typeof BOOLEAN_ATTRIBUTE_PART;
export const BOOLEAN_ATTRIBUTE_PART = 4;

export type EventPartType = typeof EVENT_PART;
export const EVENT_PART = 5;

export type ElementPartType = typeof ELEMENT_PART;
export const ELEMENT_PART = 6;

export type CommentPartType = typeof COMMENT_PART;
export const COMMENT_PART = 7;


/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
export const noChange: symbol = Symbol.for('lit-noChange');


/**
 * A sentinel value that signals a ChildPart to fully clear its content.
 *
 * ```ts
 * const button = html`${
 *  user.isAdmin
 *    ? html`<button>DELETE</button>`
 *    : nothing
 * }`;
 * ```
 *
 * Prefer using `nothing` over other falsy values as it provides a consistent
 * behavior between various expression binding contexts.
 *
 * In child expressions, `undefined`, `null`, `''`, and `nothing` all behave the
 * same and render no nodes. In attribute expressions, `nothing` _removes_ the
 * attribute, while `undefined` and `null` will render an empty string. In
 * property expressions `nothing` becomes `undefined`.
 */
export const nothing: symbol = Symbol.for('lit-nothing');


/**
 * The cache of prepared templates, keyed by the tagged TemplateStringsArray
 * and _not_ accounting for the specific template tag used. This means that
 * template tags cannot be dynamic - they must statically be one of html, svg,
 * or attr. This restriction simplifies the cache lookup, which is on the hot
 * path for rendering.
 */
export const templateCache: WeakMap<TemplateStringsArray, Template> = new WeakMap();


export const wrap: <T extends Node>(node: T) => T = ENABLE_SHADYDOM_NOPATCH.value
	&& global.ShadyDOM?.inUse
	&& global.ShadyDOM?.noPatch === true
	? global.ShadyDOM!.wrap
	: <T extends Node>(node: T) => node;


export let issueWarning: (code: string, warning: string) => void;

if (DEV_MODE.value) {
	global.litIssuedWarnings ??= new Set();

	/**
	 * Issue a warning if we haven't already, based either on `code` or `warning`.
	 * Warnings are disabled automatically only by `warning`; disabling via `code`
	 * can be done by users.
	 */
	issueWarning = (code: string, warning: string) => {
		warning += code
			? ` See https://lit.dev/msg/${ code } for more information.`
			: '';

		if (!global.litIssuedWarnings!.has(warning) && !global.litIssuedWarnings!.has(code)) {
			console.warn(warning);
			global.litIssuedWarnings!.add(warning);
		}
	};

	queueMicrotask(() => {
		issueWarning('dev-mode', `Lit is in dev mode. Not recommended for production!`);
	});
}
