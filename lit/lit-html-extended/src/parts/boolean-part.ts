import { BOOLEAN_ATTRIBUTE_PART, type BooleanPartType, nothing, wrap } from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { AttributePart } from './attribute-part.ts';


/** @internal */
export class BooleanAttributePart extends AttributePart {

	override readonly type: BooleanPartType = BOOLEAN_ATTRIBUTE_PART;

	/** @internal */
	override _commitValue(value: unknown): void {
		debugLogEvent?.({
			kind:    'commit boolean attribute',
			element: this.element,
			name:    this.name,
			value:   !!(value && value !== nothing),
			options: this.options,
		});

		wrap(this.element).toggleAttribute(this.name, !!value && value !== nothing);
	}

}
