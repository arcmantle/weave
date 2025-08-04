/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { noChange } from '../constants.ts';
import { isPrimitive } from '../helpers.ts';
import type { AttributePart } from '../parts/attribute-part.ts';
import type { ChildPart } from '../parts/child-part.ts';
import type { Disconnectable } from '../parts/disconnectable.ts';
import type { ElementPart } from '../parts/element-part.ts';
import type { Part } from '../parts/template.ts';


export type DirectiveClass = new (part: PartInfo) => Directive;


/**
 * This utility type extracts the signature of a directive class's render()
 * method so we can use it for the type of the generated directive function.
 */
export type DirectiveParameters<C extends Directive> = Parameters<C['render']>;


/**
 * A generated directive function doesn't evaluate the directive, but just
 * returns a DirectiveResult object that captures the arguments.
 */
export interface DirectiveResult<C extends DirectiveClass = DirectiveClass> {
	/**
   * This property needs to remain unminified.
   * @internal
   */
	['_$litDirective$']: C;
	/** @internal */
	values:              DirectiveParameters<InstanceType<C>>;
}


export const PartType = {
	ATTRIBUTE:         1,
	CHILD:             2,
	PROPERTY:          3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT:             5,
	ELEMENT:           6,
} as const;


export type PartType = (typeof PartType)[keyof typeof PartType];


export interface ChildPartInfo {
	readonly type: typeof PartType.CHILD;
}


export interface AttributePartInfo {
	readonly type:
    | typeof PartType.ATTRIBUTE
    | typeof PartType.PROPERTY
    | typeof PartType.BOOLEAN_ATTRIBUTE
    | typeof PartType.EVENT;
	readonly strings?: readonly string[];
	readonly name:     string;
	readonly tagName:  string;
}


export interface ElementPartInfo {
	readonly type: typeof PartType.ELEMENT;
}


/**
 * Information about the part a directive is bound to.
 *
 * This is useful for checking that a directive is attached to a valid part,
 * such as with directive that can only be used on attribute bindings.
 */
export type PartInfo = ChildPartInfo | AttributePartInfo | ElementPartInfo;


/**
 * Creates a user-facing directive function from a Directive class. This
 * function has the same parameters as the directive's render() method.
 */
export const directive = <C extends DirectiveClass>(c: C) => (
	...values: DirectiveParameters<InstanceType<C>>
): DirectiveResult<C> => ({
	// This property needs to remain unminified.
	['_$litDirective$']: c,
	values,
});


/**
 * Base class for creating custom directives. Users should extend this class,
 * implement `render` and/or `update`, and then pass their subclass to
 * `directive`.
 */
export abstract class Directive implements Disconnectable {

	/** @internal */
	__part!: Part;

	/** @internal */
	__attributeIndex: number | undefined;

	/** @internal */
	__directive?: Directive;

	/** @internal */
	_$parent!: Disconnectable;

	// These will only exist on the AsyncDirective subclass
	/** @internal */
	_$disconnectableChildren?: Set<Disconnectable>;
	// This property needs to remain unminified.
	/** @internal */
	['_$notifyDirectiveConnectionChanged']?(isConnected: boolean): void;

	constructor(_partInfo: PartInfo) {}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected(): boolean {
		return this._$parent._$isConnected;
	}

	/** @internal */
	_$initialize(
		part: Part,
		parent: Disconnectable,
		attributeIndex: number | undefined,
	): void {
		this.__part = part;
		this._$parent = parent;
		this.__attributeIndex = attributeIndex;
	}

	/** @internal */
	_$resolve(part: Part, props: unknown[]): unknown {
		return this.update(part, props);
	}

	abstract render(...props: unknown[]): unknown;

	update(_part: Part, props: unknown[]): unknown {
		return this.render(...props);
	}

}


// Type for classes that have a `_directive` or `_directives[]` field,
// used by `resolveDirective`
export interface DirectiveParent {
	_$parent?:     DirectiveParent;
	_$isConnected: boolean;
	__directive?:  Directive;
	__directives?: (Directive | undefined)[];
}


export function resolveDirective(
	part: ChildPart | AttributePart | ElementPart,
	value: unknown,
	parent: DirectiveParent = part,
	attributeIndex?: number,
): unknown {
	// Bail early if the value is explicitly noChange. Note, this means any
	// nested directive is still attached and is not run.
	if (value === noChange)
		return value;

	let currentDirective = attributeIndex !== undefined
		? (parent as AttributePart).__directives?.[attributeIndex]
		: (parent as ChildPart | ElementPart | Directive).__directive;

	const nextDirectiveConstructor = isPrimitive(value)
		? undefined
		: (value as DirectiveResult)['_$litDirective$']; /* Must be unminified */

	if (currentDirective?.constructor !== nextDirectiveConstructor) {
		// This property needs to remain unminified.
		currentDirective?.['_$notifyDirectiveConnectionChanged']?.(false);
		if (nextDirectiveConstructor === undefined) {
			currentDirective = undefined;
		}
		else {
			currentDirective = new nextDirectiveConstructor(part as PartInfo);
			currentDirective._$initialize(part, parent, attributeIndex);
		}
		if (attributeIndex !== undefined) {
			((parent as AttributePart).__directives ??= [])[attributeIndex] =
		  currentDirective;
		}
		else {
			(parent as ChildPart | Directive).__directive = currentDirective;
		}
	}
	if (currentDirective !== undefined) {
		value = resolveDirective(
			part,
			currentDirective._$resolve(part, (value as DirectiveResult).values),
			currentDirective,
			attributeIndex,
		);
	}

	return value;
}
