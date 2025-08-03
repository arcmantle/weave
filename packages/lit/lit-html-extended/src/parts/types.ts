import type { CommentPartType, HTMLResult, MATHMLResult, ResultType, SVGResult } from '../constants.ts';
import type { Template } from './template.ts';


/**
 * The return type of the template tag functions, {@linkcode html} and
 * {@linkcode svg} when it hasn't been compiled by @lit-labs/compiler.
 *
 * A `TemplateResult` object holds all the information about a template
 * expression required to render it: the template strings, expression values,
 * and type of template (html or svg).
 *
 * `TemplateResult` objects do not create any DOM on their own. To create or
 * update DOM you need to render the `TemplateResult`. See
 * [Rendering](https://lit.dev/docs/components/rendering) for more information.
 *
 */
export interface UncompiledTemplateResult<T extends ResultType = ResultType> {
	// This property needs to remain unminified.
	['_$litType$']: T;
	strings:        TemplateStringsArray;
	values:         unknown[];
}


/**
 * This is a template result that may be either uncompiled or compiled.
 *
 * In the future, TemplateResult will be this type. If you want to explicitly
 * note that a template result is potentially compiled, you can reference this
 * type and it will continue to behave the same through the next major version
 * of Lit. This can be useful for code that wants to prepare for the next
 * major version of Lit.
 */
export type MaybeCompiledTemplateResult<T extends ResultType = ResultType> =
  | UncompiledTemplateResult<T>
  | CompiledTemplateResult;


/**
 * The return type of the template tag functions, {@linkcode html} and
 * {@linkcode svg}.
 *
 * A `TemplateResult` object holds all the information about a template
 * expression required to render it: the template strings, expression values,
 * and type of template (html or svg).
 *
 * `TemplateResult` objects do not create any DOM on their own. To create or
 * update DOM you need to render the `TemplateResult`. See
 * [Rendering](https://lit.dev/docs/components/rendering) for more information.
 *
 * In Lit 4, this type will be an alias of
 * MaybeCompiledTemplateResult, so that code will get type errors if it assumes
 * that Lit templates are not compiled. When deliberately working with only
 * one, use either {@linkcode CompiledTemplateResult} or
 * {@linkcode UncompiledTemplateResult} explicitly.
 */
export type TemplateResult<T extends ResultType = ResultType> = UncompiledTemplateResult<T>;

export type HTMLTemplateResult = TemplateResult<HTMLResult>;

export type SVGTemplateResult = TemplateResult<SVGResult>;

export type MathMLTemplateResult = TemplateResult<MATHMLResult>;

export type TemplateProducer = (strings: TemplateStringsArray, ...values: unknown[]) => TemplateResult;


/**
 * A TemplateResult that has been compiled by @lit-labs/compiler, skipping the
 * prepare step.
 */
export interface CompiledTemplateResult {
	// This is a factory in order to make template initialization lazy
	// and allow ShadyRenderOptions scope to be passed in.
	// This property needs to remain unminified.
	['_$litType$']: CompiledTemplate;
	values:         unknown[];
}


export interface CompiledTemplate extends Omit<Template, 'el'> {
	// el is overridden to be optional. We initialize it on first render
	el?: HTMLTemplateElement;

	// The prepared HTML string to create a template element from.
	// The type is a TemplateStringsArray to guarantee that the value came from
	// source code, preventing a JSON injection attack.
	h: TemplateStringsArray;
}


export interface CommentTemplatePart {
	readonly type:  CommentPartType;
	readonly index: number;
}


/**
 * Object specifying options for controlling lit-html rendering. Note that
 * while `render` may be called multiple times on the same `container` (and
 * `renderBefore` reference node) to efficiently update the rendered content,
 * only the options passed in during the first render are respected during
 * the lifetime of renders to that unique `container` + `renderBefore`
 * combination.
 */
export interface RenderOptions {
	/**
	* An object to use as the `this` value for event listeners. It's often
	* useful to set this to the host component rendering a template.
	*/
	host?:          object;
	/**
	* A DOM node before which to render content in the container.
	*/
	renderBefore?:  ChildNode | null;
	/**
	* Node used for cloning the template (`importNode` will be called on this
	* node). This controls the `ownerDocument` of the rendered DOM, along with
	* any inherited context. Defaults to the global `document`.
	*/
	creationScope?: { importNode(node: Node, deep?: boolean): Node; };
	/**
	* The initial connected state for the top-level part being rendered. If no
	* `isConnected` option is set, `AsyncDirective`s will be connected by
	* default. Set to `false` if the initial render occurs in a disconnected tree
	* and `AsyncDirective`s should see `isConnected === false` for their initial
	* render. The `part.setConnected()` method must be used subsequent to initial
	* render to change the connected state of the part.
	*/
	isConnected?:   boolean;
}
