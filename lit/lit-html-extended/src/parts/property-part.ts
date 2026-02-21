import { ENABLE_EXTRA_SECURITY_HOOKS, nothing, PROPERTY_PART, type PropertyPartType } from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { sanitizerFactoryInternal } from '../security.ts';
import { AttributePart } from './attribute-part.ts';


/** @internal */
export class PropertyPart extends AttributePart {

	override readonly type: PropertyPartType = PROPERTY_PART;

	/** @internal */
	override _commitValue(value: unknown): void {
		if (ENABLE_EXTRA_SECURITY_HOOKS.value) {
			if (this._sanitizer === undefined) {
				this._sanitizer = sanitizerFactoryInternal(
					this.element,
					this.name,
					'property',
				);
			}

			value = this._sanitizer(value);
		}

		debugLogEvent?.({
			kind:    'commit property',
			element: this.element,
			name:    this.name,
			value,
			options: this.options,
		});

		type HTMLRecord = HTMLElement & Record<keyof any, any>;
		(this.element as HTMLRecord)[this.name] = value === nothing ? undefined : value;
	}

}
