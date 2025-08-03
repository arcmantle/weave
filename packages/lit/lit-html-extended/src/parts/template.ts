import type { TrustedHTML } from 'trusted-types/lib/index';

import {
	ATTRIBUTE_PART, boundAttributeSuffix,
	CHILD_PART, COMMENT_PART,
	createMarker,
	DEV_MODE,
	doc,
	ELEMENT_PART,
	issueWarning,
	marker,
	markerMatch,
	MATHML_RESULT,
	rawTextElement,
	SVG_RESULT,
	walker,
} from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import type { GlobalType } from '../global-type.ts';
import { AttributePart, type AttributeTemplatePart } from './attribute-part.ts';
import { BooleanAttributePart } from './boolean-part.ts';
import { ChildPart, type ChildTemplatePart } from './child-part.ts';
import type { Disconnectable } from './disconnectable.ts';
import { ElementPart, type ElementTemplatePart } from './element-part.ts';
import { EventPart } from './event-part.ts';
import { getTemplateHtml } from './part-helpers.ts';
import { PropertyPart } from './property-part.ts';
import type { CommentTemplatePart, RenderOptions, UncompiledTemplateResult } from './types.ts';


// Allows minifiers to rename references to globalThis
const global = globalThis as GlobalType;


/**
 * A TemplatePart represents a dynamic part in a template, before the template
 * is instantiated. When a template is instantiated Parts are created from
 * TemplateParts.
 */
export type TemplatePart =
  | ChildTemplatePart
  | AttributeTemplatePart
  | ElementTemplatePart
  | CommentTemplatePart;


export type Part =
  | ChildPart
  | AttributePart
  | PropertyPart
  | BooleanAttributePart
  | ElementPart
  | EventPart;

/** @internal */
export class Template {

	/** @internal */
	el: HTMLTemplateElement;

	parts: TemplatePart[] = [];

	constructor(
		// This property needs to remain unminified.
		{ strings, ['_$litType$']: type }: UncompiledTemplateResult,
		options?: RenderOptions,
	) {
		let node: Node | null;
		let nodeIndex = 0;
		let attrNameIndex = 0;
		const partCount = strings.length - 1;
		const parts = this.parts;

		// Create template element
		const [ html, attrNames ] = getTemplateHtml(strings, type);
		this.el = Template.createElement(html, options);
		walker.currentNode = this.el.content;

		// Re-parent SVG or MathML nodes into template root
		if (type === SVG_RESULT || type === MATHML_RESULT) {
			const wrapper = this.el.content.firstChild!;
			wrapper.replaceWith(...wrapper.childNodes);
		}

		// Walk the template to find binding markers and create TemplateParts
		while ((node = walker.nextNode()) !== null && parts.length < partCount) {
			if (node.nodeType === 1) {
				if (DEV_MODE.value) {
					const tag = (node as Element).localName;
					// Warn if `textarea` includes an expression and throw if `template`
					// does since these are not supported. We do this by checking
					// innerHTML for anything that looks like a marker. This catches
					// cases like bindings in textarea there markers turn into text nodes.
					if (/^(?:textarea|template)$/i!.test(tag) && (node as Element).innerHTML.includes(marker)) {
						const m = ''
							+ `Expressions are not supported inside \`${ tag }\` `
							+ `elements. See https://lit.dev/msg/expression-in-${ tag } for more `
							+ `information.`;

						if (tag === 'template')
							throw new Error(m);
						else
							issueWarning('', m);
					}
				}
				// TODO (justinfagnani):
				// for attempted dynamic tag names, we don't increment the bindingIndex,
				// and it'll be off by 1 in the element and off by two after it.
				if ((node as Element).hasAttributes()) {
					for (const name of (node as Element).getAttributeNames()) {
						if (name.endsWith(boundAttributeSuffix)) {
							const realName = attrNames[attrNameIndex++]!;
							const value = (node as Element).getAttribute(name)!;
							const statics = value.split(marker);
							const m = /([.?@])?(.*)/.exec(realName)!;
							parts.push({
								type:    ATTRIBUTE_PART,
								index:   nodeIndex,
								name:    m[2]!,
								strings: statics,
								ctor:    m[1] === '.'
									? PropertyPart
									: m[1] === '?'
										? BooleanAttributePart
										: m[1] === '@'
											? EventPart
											: AttributePart,
							});
							(node as Element).removeAttribute(name);
						}
						else if (name.startsWith(marker)) {
							parts.push({
								type:  ELEMENT_PART,
								index: nodeIndex,
							});
							(node as Element).removeAttribute(name);
						}
					}
				}
				// TODO (justinfagnani):
				// benchmark the regex against testing for each of the 3 raw text element names.
				if (rawTextElement.test((node as Element).tagName)) {
					// For raw text elements we need to split the text content on
					// markers, create a Text node for each segment, and create
					// a TemplatePart for each marker.
					const strings = (node as Element).textContent!.split(marker);
					const lastIndex = strings.length - 1;
					if (lastIndex > 0) {
						(node as Element).textContent = global.trustedTypes
							? (global.trustedTypes.emptyScript as unknown as '')
							: '';

						// Generate a new text node for each literal section
						// These nodes are also used as the markers for child parts
						for (let i = 0; i < lastIndex; i++) {
							(node as Element).append(strings[i]!, createMarker());
							// Walk past the marker node we just added
							walker.nextNode();
							parts.push({ type: CHILD_PART, index: ++nodeIndex });
						}
						// Note because this marker is added after the walker's current
						// node, it will be walked to in the outer loop (and ignored), so
						// we don't need to adjust nodeIndex here
						(node as Element).append(strings[lastIndex]!, createMarker());
					}
				}
			}
			else if (node.nodeType === 8) {
				const data = (node as Comment).data;
				if (data === markerMatch) {
					parts.push({ type: CHILD_PART, index: nodeIndex });
				}
				else {
					let i = -1;
					while ((i = (node as Comment).data.indexOf(marker, i + 1)) !== -1) {
						// Comment node has a binding marker inside, make an inactive part
						// The binding won't work, but subsequent bindings will
						parts.push({ type: COMMENT_PART, index: nodeIndex });
						// Move to the end of the match
						i += marker.length - 1;
					}
				}
			}

			nodeIndex++;
		}

		if (DEV_MODE.value) {
			// If there was a duplicate attribute on a tag, then when the tag is
			// parsed into an element the attribute gets de-duplicated. We can detect
			// this mismatch if we haven't precisely consumed every attribute name
			// when preparing the template. This works because `attrNames` is built
			// from the template string and `attrNameIndex` comes from processing the
			// resulting DOM.
			if (attrNames.length !== attrNameIndex) {
				throw new Error(''
				+ 'Detected duplicate attribute bindings. This occurs if your template '
				+ 'has duplicate attributes on an element tag. For example '
				+ '"<input ?disabled=${true} ?disabled=${false}>" contains a '
				+ 'duplicate "disabled" attribute. The error was detected in '
				+ 'the following template: \n'
				+ '`'
				+ strings.join('${...}')
				+ '`');
			}
		}

		// We could set walker.currentNode to another node here to prevent a memory
		// leak, but every time we prepare a template, we immediately render it
		// and re-use the walker in new TemplateInstance._clone().
		debugLogEvent?.({
			kind:             'template prep',
			template:         this,
			clonableTemplate: this.el,
			parts:            this.parts,
			strings,
		});
	}

	// Overridden via `litHtmlPolyfillSupport` to provide platform support.
	/** @nocollapse */
	static createElement(html: TrustedHTML, _options?: RenderOptions): HTMLTemplateElement {
		const el = doc.createElement('template');
		el.innerHTML = html as unknown as string;

		return el;
	}

}


/**
 * An updatable instance of a Template. Holds references to the Parts used to
 * update the template instance.
 */
export class TemplateInstance implements Disconnectable {

	_$template: Template;
	_$parts:    (Part | undefined)[] = [];

	/** @internal */
	_$parent:                  ChildPart;
	/** @internal */
	_$disconnectableChildren?: Set<Disconnectable> = undefined;

	constructor(template: Template, parent: ChildPart) {
		this._$template = template;
		this._$parent = parent;
	}

	// Called by ChildPart parentNode getter
	get parentNode(): Node {
		return this._$parent.parentNode;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected(): boolean {
		return this._$parent._$isConnected;
	}

	// This method is separate from the constructor because we need to return a
	// DocumentFragment and we don't want to hold onto it with an instance field.
	_clone(options: RenderOptions | undefined): Node {
		const { el: { content }, parts: parts } = this._$template;
		const fragment = (options?.creationScope ?? doc).importNode(content, true);
		walker.currentNode = fragment;

		let node = walker.nextNode()!;
		let nodeIndex = 0;
		let partIndex = 0;
		let templatePart = parts[0];

		while (templatePart !== undefined) {
			if (nodeIndex === templatePart.index) {
				let part: Part | undefined;
				if (templatePart.type === CHILD_PART) {
					part = new ChildPart(node as HTMLElement, node.nextSibling, this, options);
				}
				else if (templatePart.type === ATTRIBUTE_PART) {
					part = new templatePart.ctor(
						node as HTMLElement,
						templatePart.name,
						templatePart.strings,
						this,
						options,
					);
				}
				else if (templatePart.type === ELEMENT_PART) {
					part = new ElementPart(node as HTMLElement, this, options);
				}

				this._$parts.push(part);
				templatePart = parts[++partIndex];
			}
			if (nodeIndex !== templatePart?.index) {
				node = walker.nextNode()!;
				nodeIndex++;
			}
		}

		// We need to set the currentNode away from the cloned tree so that we
		// don't hold onto the tree even if the tree is detached and should be
		// freed.
		walker.currentNode = doc;

		return fragment;
	}

	_update(values: unknown[]): void {
		let i = 0;
		for (const part of this._$parts) {
			if (part !== undefined) {
				debugLogEvent?.({
					kind:             'set part',
					part,
					value:            values[i],
					valueIndex:       i,
					values,
					templateInstance: this,
				});

				if ((part as AttributePart).strings !== undefined) {
					(part as AttributePart)._$setValue(values, part as AttributePart, i);
					// The number of values the part consumes is part.strings.length - 1
					// since values are in between template spans. We increment i by 1
					// later in the loop, so increment it by part.strings.length - 2 here
					i += (part as AttributePart).strings!.length - 2;
				}
				else {
					part._$setValue(values[i]);
				}
			}

			i++;
		}
	}

}
