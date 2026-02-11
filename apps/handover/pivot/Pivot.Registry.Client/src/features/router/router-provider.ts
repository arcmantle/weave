import { provide } from '@lit/context';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { Router, type RouterConfig, routerContext } from './router.ts';


@customElement('router-provider')
export class RouterProvider extends LitElement {

	@provide({ context: routerContext })
	@property({ attribute: false })
	router: Router;

	constructor(config?: RouterConfig) {
		super();
		this.router = new Router(config);
	}

	override render(): TemplateResult {
		return html`<slot></slot>`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'router-provider': RouterProvider;
	}
}
