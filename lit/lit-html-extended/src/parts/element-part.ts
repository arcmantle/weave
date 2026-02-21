import { ELEMENT_PART, type ElementPartType } from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { type Directive, resolveDirective } from '../directives/directive.ts';
import type { Disconnectable } from './disconnectable.ts';
import type { RenderOptions } from './types.ts';


/** @internal */
export interface ElementTemplatePart {
	readonly type:  ElementPartType;
	readonly index: number;
}


/** @internal */
export class ElementPart implements Disconnectable {

	readonly type: ElementPartType = ELEMENT_PART;

	/** @internal */
	__directive?: Directive;

	// This is to ensure that every Part has a _$committedValue
	_$committedValue: undefined;

	/** @internal */
	_$parent!: Disconnectable;

	/** @internal */
	_$disconnectableChildren?: Set<Disconnectable> = undefined;

	options: RenderOptions | undefined;

	constructor(
		public element: Element,
		parent: Disconnectable,
		options: RenderOptions | undefined,
	) {
		this._$parent = parent;
		this.options = options;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected(): boolean {
		return this._$parent._$isConnected;
	}

	_$setValue(value: unknown): void {
		debugLogEvent?.({
			kind:    'commit to element binding',
			element: this.element,
			value,
			options: this.options,
		});
		resolveDirective(this, value);
	}

}
