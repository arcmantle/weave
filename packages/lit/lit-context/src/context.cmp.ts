import { css, type CSSResultGroup, html, LitElement, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import { type ConsumeContextEvent, createEventName, createHydrateName } from './context.js';


export interface Context { name: string; value: any; }


export class ContextProvider extends LitElement {

	static tagName = 'context-provider';
	static register(): void {
		if (!globalThis.customElements.get(this.tagName))
			globalThis.customElements.define(this.tagName, this);
	}

	@property({ type: Object }) context: Record<string, any>;

	#listeners: { name: string; listener: (ev: Event) => any; }[] = [];

	override connectedCallback(): void {
		this.setupContext();

		super.connectedCallback();
	}

	protected override willUpdate(changedProps: PropertyValues): void {
		super.willUpdate(changedProps);

		if (changedProps.has('context') && this.hasUpdated)
			this.setupContext();
	}

	protected setupContext(): void {
		// Remove all old listeners when a new context array has been assigned.
		this.#listeners.forEach(o => this.removeEventListener(o.name, o.listener));
		this.#listeners.length = 0;

		// Hook up the new context listeners.
		for (const [ key ] of Object.entries(this.context)) {
			const eventName = createEventName(key);
			const provideHandler = (ev: Event) => {
				ev.preventDefault();
				ev.stopPropagation();
				ev.stopImmediatePropagation();

				const me = this as this & Record<keyof any, any>;
				const event = ev as ConsumeContextEvent;
				event.detail.prop = {
					get value() {
						return me.context[key];
					},
					set value(value: any) {
						const oldValue = me.context[key];
						if (oldValue === value)
							return;

						me.context[key] = value;

						const hydrateName = createHydrateName(key);
						const ev = new CustomEvent(hydrateName, {
							bubbles:    true,
							composed:   true,
							cancelable: false,
						});

						globalThis.dispatchEvent(ev);
					},
				};
			};

			this.#listeners.push({ name: eventName, listener: provideHandler });
			this.addEventListener(eventName, provideHandler);
		}
	}

	protected override render(): unknown {
		return html`<slot></slot>`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: contents;
		}
	`;

}


declare global {
	interface HTMLElementTagNameMap {
		'context-provider': ContextProvider;
	}
}
