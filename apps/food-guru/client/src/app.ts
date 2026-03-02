import '@arcmantle/pivot-client-router';

import { router } from '@arcmantle/pivot-client-router';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { routes } from './routes.ts';
import { foodGuruStore } from './state/food-guru-store.ts';


@customElement('food-guru-app')
export class FoodGuruApp extends LitElement {

	@state() protected isInitialized = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		router.setRoutes(routes);
		await foodGuruStore.initialize();
		this.isInitialized = true;
		await router.navigate(window.location.pathname);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		router.dispose();
	}

	override render(): unknown {
		return when(this.isInitialized, () => html`
		<router-outlet></router-outlet>
		`, () => html`
		<div class="loading">Loading Food Guru...</div>
		`);
	}

	static override styles = css`
		:host {
			display: grid;
			min-height: 100vh;
		}
		.loading {
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: Inter, Segoe UI, Arial, sans-serif;
			color: #58708a;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'food-guru-app': FoodGuruApp;
	}
}
