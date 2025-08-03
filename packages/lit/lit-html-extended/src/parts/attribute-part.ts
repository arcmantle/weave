import {
	ATTRIBUTE_PART,
	type AttributePartType,
	type BooleanPartType,
	ENABLE_EXTRA_SECURITY_HOOKS,
	type EventPartType,
	noChange,
	nothing,
	type PropertyPartType,
	wrap,
} from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { type Directive, type DirectiveParent, resolveDirective } from '../directive.ts';
import { isPrimitive } from '../helpers.ts';
import { sanitizerFactoryInternal, type ValueSanitizer } from '../security.ts';
import type { Disconnectable } from './disconnectable.ts';
import type { RenderOptions } from './types.ts';


/** @internal */
export interface AttributeTemplatePart {
	readonly type:    AttributePartType;
	readonly index:   number;
	readonly name:    string;
	readonly ctor:    typeof AttributePart;
	readonly strings: readonly string[];
}


/* @internal */
export class AttributePart implements Disconnectable {

	readonly type:
	 | AttributePartType
	 | PropertyPartType
	 | BooleanPartType
	 | EventPartType = ATTRIBUTE_PART;

	readonly element: HTMLElement;
	readonly name:    string;
	readonly options: RenderOptions | undefined;

	/**
	* If this attribute part represents an interpolation,
	* this contains the static strings of the interpolation.
	* For single-value, complete bindings, this is undefined.
	*/
	readonly strings?: readonly string[];

	/** @internal */
	_$committedValue: unknown | unknown[] = nothing;

	/** @internal */
	__directives?: (Directive | undefined)[];

	/** @internal */
	_$parent: Disconnectable;

	/** @internal */
	_$disconnectableChildren?: Set<Disconnectable> = undefined;

	protected _sanitizer: ValueSanitizer | undefined;

	get tagName(): string {
		return this.element.tagName;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected(): boolean {
		return this._$parent._$isConnected;
	}

	constructor(
		element: HTMLElement,
		name: string,
		strings: readonly string[],
		parent: Disconnectable,
		options: RenderOptions | undefined,
	) {
		this.element = element;
		this.name = name;
		this._$parent = parent;
		this.options = options;
		if (strings.length > 2 || strings[0] !== '' || strings[1] !== '') {
			this._$committedValue = new Array(strings.length - 1).fill(new String());
			this.strings = strings;
		}
		else {
			this._$committedValue = nothing;
		}
		if (ENABLE_EXTRA_SECURITY_HOOKS.value)
			this._sanitizer = undefined;
	}

	/**
	 * Sets the value of this part by resolving the value from possibly multiple
	 * values and static strings and committing it to the DOM.
	 * If this part is single-valued, `this._strings` will be undefined, and the
	 * method will be called with a single value argument. If this part is
	 * multi-value, `this._strings` will be defined, and the method is called
	 * with the value array of the part's owning TemplateInstance, and an offset
	 * into the value array from which the values should be read.
	 * This method is overloaded this way to eliminate short-lived array slices
	 * of the template instance values, and allow a fast-path for single-valued
	 * parts.
	 *
	 * @param value The part value, or an array of values for multi-valued parts
	 * @param valueIndex the index to start reading values from. `undefined` for
	 *   single-valued parts
	 * @param noCommit causes the part to not commit its value to the DOM. Used
	 *   in hydration to prime attribute parts with their first-rendered value,
	 *   but not set the attribute, and in SSR to no-op the DOM operation and
	 *   capture the value for serialization.
	 *
	 * @internal
	 */
	_$setValue(
		value: unknown | unknown[],
		directiveParent: DirectiveParent = this,
		valueIndex?: number,
		noCommit?: boolean,
	): void {
		const strings = this.strings;

		// Whether any of the values has changed, for dirty-checking
		let change = false;

		if (strings === undefined) {
			// Single-value binding case
			value = resolveDirective(this, value, directiveParent, 0);
			change = !isPrimitive(value) || (value !== this._$committedValue && value !== noChange);
			if (change)
				this._$committedValue = value;
		}
		else {
			// Interpolation case
			const values = value as unknown[];
			value = strings[0];

			let i, v;
			for (i = 0; i < strings.length - 1; i++) {
				v = resolveDirective(this, values[valueIndex! + i], directiveParent, i);

				if (v === noChange) {
					// If the user-provided value is `noChange`, use the previous value
					v = (this._$committedValue as unknown[])[i];
				}

				change ||=
			 !isPrimitive(v) || v !== (this._$committedValue as unknown[])[i];
				if (v === nothing)
					value = nothing;
				else if (value !== nothing)
					value += (v ?? '') + strings[i + 1]!;

				// We always record each value, even if one is `nothing`,
				// for future change detection.
				(this._$committedValue as unknown[])[i] = v;
			}
		}
		if (change && !noCommit)
			this._commitValue(value);
	}

	/** @internal */
	_commitValue(value: unknown): void {
		if (value === nothing) {
			wrap(this.element).removeAttribute(this.name);
		}
		else {
			if (ENABLE_EXTRA_SECURITY_HOOKS.value) {
				if (this._sanitizer === undefined) {
					this._sanitizer = sanitizerFactoryInternal(
						this.element,
						this.name,
						'attribute',
					);
				}

				value = this._sanitizer(value ?? '');
			}

			debugLogEvent?.({
				kind:    'commit attribute',
				element: this.element,
				name:    this.name,
				value,
				options: this.options,
			});

			wrap(this.element).setAttribute(this.name, (value ?? '') as string);
		}
	}

}
