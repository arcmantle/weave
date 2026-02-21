import { CHILD_PART, type ChildPartType, createMarker, DEV_MODE, doc, ENABLE_EXTRA_SECURITY_HOOKS, noChange, nothing, templateCache, wrap } from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { type Directive, type DirectiveParent, resolveDirective } from '../directives/directive.ts';
import { isIterable, isPrimitive } from '../helpers.ts';
import { createSanitizer, noopSanitizer, sanitizerFactoryInternal, trustFromTemplateString, type ValueSanitizer } from '../security.ts';
import type { Disconnectable } from './disconnectable.ts';
import { Template, TemplateInstance } from './template.ts';
import type { CompiledTemplate, CompiledTemplateResult, RenderOptions, TemplateResult, UncompiledTemplateResult } from './types.ts';


/** @internal */
export interface ChildTemplatePart {
	readonly type:  ChildPartType;
	readonly index: number;
}


/** @internal */
export class ChildPart implements Disconnectable {

	readonly type:          ChildPartType = CHILD_PART;
	readonly options:       RenderOptions | undefined;
	_$committedValue:       unknown = nothing;
	/** @internal */
	__directive?:           Directive;
	/** @internal */
	_$startNode:            ChildNode;
	/** @internal */
	_$endNode:              ChildNode | null;
	private _textSanitizer: ValueSanitizer | undefined;
	/** @internal */
	_$parent:               Disconnectable | undefined;
	/**
	* Connection state for RootParts only (i.e. ChildPart without _$parent
	* returned from top-level `render`). This field is unused otherwise. The
	* intention would be clearer if we made `RootPart` a subclass of `ChildPart`
	* with this field (and a different _$isConnected getter), but the subclass
	* caused a perf regression, possibly due to making call sites polymorphic.
	* @internal
	*/
	__isConnected:          boolean;

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected(): boolean {
		// ChildParts that are not at the root should always be created with a
		// parent; only RootChildNode's won't, so they return the local isConnected
		// state
		return this._$parent?._$isConnected ?? this.__isConnected;
	}

	// The following fields will be patched onto ChildParts when required by AsyncDirective
	/** @internal */
	_$disconnectableChildren?: Set<Disconnectable> = undefined;

	/** @internal */
	_$notifyConnectionChanged?(
		isConnected: boolean,
		removeFromParent?: boolean,
		from?: number
	): void;

	/** @internal */
	_$reparentDisconnectables?(parent: Disconnectable): void;

	constructor(
		startNode: ChildNode,
		endNode: ChildNode | null,
		parent: TemplateInstance | ChildPart | undefined,
		options: RenderOptions | undefined,
	) {
		this._$startNode = startNode;
		this._$endNode = endNode;
		this._$parent = parent;
		this.options = options;
		// Note __isConnected is only ever accessed on RootParts (i.e. when there is
		// no _$parent); the value on a non-root-part is "don't care", but checking
		// for parent would be more code
		this.__isConnected = options?.isConnected ?? true;
		if (ENABLE_EXTRA_SECURITY_HOOKS) {
			// Explicitly initialize for consistent class shape.
			this._textSanitizer = undefined;
		}
	}

	/**
	 * The parent node into which the part renders its content.
	 *
	 * A ChildPart's content consists of a range of adjacent child nodes of
	 * `.parentNode`, possibly bordered by 'marker nodes' (`.startNode` and
	 * `.endNode`).
	 *
	 * - If both `.startNode` and `.endNode` are non-null, then the part's content
	 * consists of all siblings between `.startNode` and `.endNode`, exclusively.
	 *
	 * - If `.startNode` is non-null but `.endNode` is null, then the part's
	 * content consists of all siblings following `.startNode`, up to and
	 * including the last child of `.parentNode`. If `.endNode` is non-null, then
	 * `.startNode` will always be non-null.
	 *
	 * - If both `.endNode` and `.startNode` are null, then the part's content
	 * consists of all child nodes of `.parentNode`.
	*/
	get parentNode(): Node {
		let parentNode: Node = wrap(this._$startNode).parentNode!;
		const parent = this._$parent as ChildPart | TemplateInstance | undefined;
		const isDocumentFragment = parentNode?.nodeType === 11;

		if (parent !== undefined && isDocumentFragment) {
			// If the parentNode is a DocumentFragment, it may be because the DOM is
			// still in the cloned fragment during initial render; if so, get the real
			// parentNode the part will be committed into by asking the parent.
			parentNode = parent.parentNode;
		}

		return parentNode;
	}

	/**
	* The part's leading marker node, if any. See `.parentNode` for more
	* information.
	*/
	get startNode(): Node | null {
		return this._$startNode;
	}

	/**
	* The part's trailing marker node, if any. See `.parentNode` for more
	* information.
	*/
	get endNode(): Node | null {
		return this._$endNode;
	}

	_$setValue(value: unknown, directiveParent: DirectiveParent = this): void {
		if (DEV_MODE.value && this.parentNode === null) {
			throw new Error(''
			+ `This \`ChildPart\` has no \`parentNode\` and therefore cannot accept a value. `
			+ `This likely means the element containing the part was manipulated in an unsupported way `
			+ `outside of Lit's control such that the part's marker nodes were ejected from DOM. `
			+ `For example, setting the element's \`innerHTML\` or \`textContent\` can do this.`);
		}

		value = resolveDirective(this, value, directiveParent);
		if (isPrimitive(value)) {
			// Non-rendering child values. It's important that these do not render
			// empty text nodes to avoid issues with preventing default <slot>
			// fallback content.
			if (value === nothing || value == null || value === '') {
				if (this._$committedValue !== nothing) {
					debugLogEvent?.({
						kind:    'commit nothing to child',
						start:   this._$startNode,
						end:     this._$endNode,
						parent:  this._$parent,
						options: this.options,
					});

					this._$clear();
				}

				this._$committedValue = nothing;
			}
			else if (value !== this._$committedValue && value !== noChange) {
				this._commitText(value);
			}
		}
		// This property needs to remain unminified.
		else if ((value as TemplateResult)['_$litType$'] !== undefined) {
			this._commitTemplateResult(value as TemplateResult);
		}
		else if ((value as Node).nodeType !== undefined) {
			if (DEV_MODE.value && this.options?.host === value) {
				this._commitText(''
					+ `[probable mistake: rendered a template's host in itself `
					+ `(commonly caused by writing \${this} in a template]`);

				console.warn(
					`Attempted to render the template host`, value,
					`inside itself. This is almost always a mistake, and in dev mode `,
					`we render some warning text. In production however, we'll `,
					`render it, which will usually result in an error, and sometimes `,
					`in the element disappearing from the DOM.`,
				);

				return;
			}

			this._commitNode(value as Node);
		}
		else if (isIterable(value)) {
			this._commitIterable(value);
		}
		else {
			// Fallback, will render the string representation
			this._commitText(value);
		}
	}

	private _insert<T extends Node>(node: T) {
		return wrap(wrap(this._$startNode).parentNode!).insertBefore(
			node,
			this._$endNode,
		);
	}

	private _commitNode(value: Node): void {
		if (this._$committedValue !== value) {
			this._$clear();
			if (ENABLE_EXTRA_SECURITY_HOOKS.value && sanitizerFactoryInternal !== noopSanitizer) {
				const parentNodeName = this._$startNode.parentNode?.nodeName;

				if (parentNodeName === 'STYLE' || parentNodeName === 'SCRIPT') {
					let message = 'Forbidden';
					if (DEV_MODE.value) {
						if (parentNodeName === 'STYLE') {
							message = ''
							+ `Lit does not support binding inside style nodes. `
							+ `This is a security risk, as style injection attacks can `
							+ `exfiltrate data and spoof UIs. `
							+ `Consider instead using css\`...\` literals `
							+ `to compose styles, and do dynamic styling with `
							+ `css custom properties, ::parts, <slot>s, `
							+ `and by mutating the DOM rather than stylesheets.`;
						}
						else {
							message = ''
					 		+ `Lit does not support binding inside script nodes. `
					 		+ `This is a security risk, as it could allow arbitrary `
					 		+ `code execution.`;
						}
					}

					throw new Error(message);
				}
			}

			debugLogEvent?.({
				kind:    'commit node',
				start:   this._$startNode,
				parent:  this._$parent,
				value:   value,
				options: this.options,
			});

			this._$committedValue = this._insert(value);
		}
	}

	private _commitText(value: unknown): void {
		// If the committed value is a primitive it means we called _commitText on
		// the previous render, and we know that this._$startNode.nextSibling is a
		// Text node. We can now just replace the text content (.data) of the node.
		if (this._$committedValue !== nothing && isPrimitive(this._$committedValue)) {
			const node = wrap(this._$startNode).nextSibling as Text;
			if (ENABLE_EXTRA_SECURITY_HOOKS) {
				if (this._textSanitizer === undefined)
					this._textSanitizer = createSanitizer(node, 'data', 'property');

				value = this._textSanitizer(value);
			}

			debugLogEvent?.({
				kind:    'commit text',
				node,
				value,
				options: this.options,
			});

			(node as Text).data = value as string;
		}
		else {
			if (ENABLE_EXTRA_SECURITY_HOOKS) {
				const textNode = doc.createTextNode('');
				this._commitNode(textNode);

				// When setting text content, for security purposes it matters a lot
				// what the parent is. For example, <style> and <script> need to be
				// handled with care, while <span> does not. So first we need to put a
				// text node into the document, then we can sanitize its content.
				if (this._textSanitizer === undefined)
					this._textSanitizer = createSanitizer(textNode, 'data', 'property');

				value = this._textSanitizer(value);

				debugLogEvent?.({
					kind:    'commit text',
					node:    textNode,
					value,
					options: this.options,
				});

				textNode.data = value as string;
			}
			else {
				this._commitNode(doc.createTextNode(value as string));

				debugLogEvent?.({
					kind:    'commit text',
					node:    wrap(this._$startNode).nextSibling as Text,
					value,
					options: this.options,
				});
			}
		}

		this._$committedValue = value;
	}

	private _commitTemplateResult(
		result: TemplateResult | CompiledTemplateResult,
	): void {
		// This property needs to remain unminified.
		const { values, ['_$litType$']: type } = result;
		// If $litType$ is a number, result is a plain TemplateResult and we get
		// the template from the template cache. If not, result is a
		// CompiledTemplateResult and _$litType$ is a CompiledTemplate and we need
		// to create the <template> element the first time we see it.
		const template: Template | CompiledTemplate =
		typeof type === 'number'
			? this._$getTemplate(result as UncompiledTemplateResult)
			: (type.el === undefined &&
				(type.el = Template.createElement(
					trustFromTemplateString(type.h, type.h[0]!),
					this.options,
				)),
			type);

		if ((this._$committedValue as TemplateInstance)?._$template === template) {
			debugLogEvent?.({
				kind:     'template updating',
				template,
				instance: this._$committedValue as TemplateInstance,
				parts:    (this._$committedValue as TemplateInstance)._$parts,
				options:  this.options,
				values,
			});

			(this._$committedValue as TemplateInstance)._update(values);
		}
		else {
			const instance = new TemplateInstance(template as Template, this);
			const fragment = instance._clone(this.options);
			debugLogEvent?.({
				kind:    'template instantiated',
				template,
				instance,
				parts:   instance._$parts,
				options: this.options,
				fragment,
				values,
			});

			instance._update(values);
			debugLogEvent?.({
				kind:    'template instantiated and updated',
				template,
				instance,
				parts:   instance._$parts,
				options: this.options,
				fragment,
				values,
			});

			this._commitNode(fragment);
			this._$committedValue = instance;
		}
	}

	// Overridden via `litHtmlPolyfillSupport` to provide platform support.
	/** @internal */
	_$getTemplate(result: UncompiledTemplateResult): Template {
		let template = templateCache.get(result.strings);
		if (template === undefined)
			templateCache.set(result.strings, (template = new Template(result)));

		return template;
	}

	private _commitIterable(value: Iterable<unknown>): void {
		// For an Iterable, we create a new InstancePart per item, then set its
		// value to the item. This is a little bit of overhead for every item in
		// an Iterable, but it lets us recurse easily and efficiently update Arrays
		// of TemplateResults that will be commonly returned from expressions like:
		// array.map((i) => html`${i}`), by reusing existing TemplateInstances.

		// If value is an array, then the previous render was of an
		// iterable and value will contain the ChildParts from the previous
		// render. If value is not an array, clear this part and make a new
		// array for ChildParts.
		if (!Array.isArray(this._$committedValue)) {
			this._$committedValue = [];
			this._$clear();
		}

		// Lets us keep track of how many items we stamped so we can clear leftover
		// items from a previous render
		const itemParts = this._$committedValue as ChildPart[];
		let partIndex = 0;
		let itemPart: ChildPart | undefined;

		for (const item of value) {
			if (partIndex === itemParts.length) {
				// If no existing part, create a new one

				// TODO (justinfagnani):
				// test perf impact of always creating two parts
				// instead of sharing parts between nodes
				// https://github.com/lit/lit/issues/1266
				itemPart = new ChildPart(
					this._insert(createMarker()),
					this._insert(createMarker()),
					this,
					this.options,
				);

				itemParts.push(itemPart);
			}
			else {
				// Reuse an existing part
				itemPart = itemParts[partIndex]!;
			}

			itemPart._$setValue(item);
			partIndex++;
		}

		if (partIndex < itemParts.length) {
			// itemParts always have end nodes
			this._$clear(
				itemPart && wrap(itemPart._$endNode!).nextSibling,
				partIndex,
			);
			// Truncate the parts array so _value reflects the current state
			itemParts.length = partIndex;
		}
	}

	/**
	* Removes the nodes contained within this Part from the DOM.
	*
	* @param start Start node to clear from, for clearing a subset of the part's
	*     DOM (used when truncating iterables)
	* @param from  When `start` is specified, the index within the iterable from
	*     which ChildParts are being removed, used for disconnecting directives
	*     in those Parts.
	*
	* @internal
	*/
	_$clear(
		start: ChildNode | null = wrap(this._$startNode).nextSibling,
		from?: number,
	): void {
		this._$notifyConnectionChanged?.(false, true, from);
		while (start !== this._$endNode) {
			// The non-null assertion is safe because if _$startNode.nextSibling is
			// null, then _$endNode is also null, and we would not have entered this loop.
			const n = wrap(start!).nextSibling;
			wrap(start!).remove();
			start = n;
		}
	}

	/**
	* Implementation of RootPart's `isConnected`. Note that this method
	* should only be called on `RootPart`s (the `ChildPart` returned from a
	* top-level `render()` call). It has no effect on non-root ChildParts.
	* @param isConnected Whether to set
	* @internal
	*/
	setConnected(isConnected: boolean): void {
		if (this._$parent === undefined) {
			this.__isConnected = isConnected;
			this._$notifyConnectionChanged?.(isConnected);
		}

		if (this._$parent !== undefined && DEV_MODE.value) {
			throw new Error(''
			+ 'part.setConnected() may only be called on a '
			+ 'RootPart returned from render().');
		}
	}

}
