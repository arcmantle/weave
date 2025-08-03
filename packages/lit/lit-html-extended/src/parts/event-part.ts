import { DEV_MODE, EVENT_PART, type EventPartType, noChange, nothing } from '../constants.ts';
import { debugLogEvent } from '../debug.ts';
import { type DirectiveParent, resolveDirective } from '../directive.ts';
import { AttributePart } from './attribute-part.ts';
import type { Disconnectable } from './disconnectable.ts';
import type { RenderOptions } from './types.ts';


type EventListenerWithOptions = EventListenerOrEventListenerObject &
  Partial<AddEventListenerOptions>;


/**
 * An AttributePart that manages an event listener via add/removeEventListener.
 *
 * This part works by adding itself as the event listener on an element, then
 * delegating to the value passed to it. This reduces the number of calls to
 * add/removeEventListener if the listener changes frequently, such as when an
 * inline function is used as a listener.
 *
 * Because event options are passed when adding listeners, we must take case
 * to add and remove the part as a listener when the event options change.
 * @internal
 */
export class EventPart extends AttributePart {

	override readonly type: EventPartType = EVENT_PART;

	constructor(
		element: HTMLElement,
		name: string,
		strings: readonly string[],
		parent: Disconnectable,
		options: RenderOptions | undefined,
	) {
		super(element, name, strings, parent, options);

		if (DEV_MODE.value && this.strings !== undefined) {
			throw new Error(''
			+ `A \`<${ element.localName }>\` has a \`@${ name }=...\` listener with `
			+ 'invalid content. Event listeners in templates must have exactly '
			+ 'one expression and no surrounding text.');
		}
	}

	// EventPart does not use the base _$setValue/_resolveValue implementation
	// since the dirty checking is more complex
	/** @internal */
	override _$setValue(
		newListener: unknown,
		directiveParent: DirectiveParent = this,
	): void {
		newListener = resolveDirective(this, newListener, directiveParent, 0) ?? nothing;
		if (newListener === noChange)
			return;

		const oldListener = this._$committedValue;

		// If the new value is nothing or any options change we have to remove the
		// part as a listener.
		const shouldRemoveListener =
		(newListener === nothing && oldListener !== nothing) ||
		(newListener as EventListenerWithOptions).capture !==
		  (oldListener as EventListenerWithOptions).capture ||
		(newListener as EventListenerWithOptions).once !==
		  (oldListener as EventListenerWithOptions).once ||
		(newListener as EventListenerWithOptions).passive !==
		  (oldListener as EventListenerWithOptions).passive;

		// If the new value is not nothing and we removed the listener, we have
		// to add the part as a listener.
		const shouldAddListener =
		newListener !== nothing &&
		(oldListener === nothing || shouldRemoveListener);

		debugLogEvent?.({
			kind:           'commit event listener',
			element:        this.element,
			name:           this.name,
			value:          newListener,
			options:        this.options,
			removeListener: shouldRemoveListener,
			addListener:    shouldAddListener,
			oldListener,
		});

		if (shouldRemoveListener) {
			this.element.removeEventListener(
				this.name,
				this,
				oldListener as EventListenerWithOptions,
			);
		}
		if (shouldAddListener) {
			this.element.addEventListener(
				this.name,
				this,
				newListener as EventListenerWithOptions,
			);
		}

		this._$committedValue = newListener;
	}

	handleEvent(event: Event): void {
		if (typeof this._$committedValue === 'function')
			this._$committedValue.call(this.options?.host ?? this.element, event);
		else
			(this._$committedValue as EventListenerObject).handleEvent(event);
	}

}
