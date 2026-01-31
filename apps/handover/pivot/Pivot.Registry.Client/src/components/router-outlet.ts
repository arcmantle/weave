import { consume, provide } from '@lit/context';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { router, Router, routerContext, RouterController, type RouteMatch } from '../services/router.ts';

// Context for tracking route depth
export const routerDepthContext = Symbol('router-depth');

@customElement('router-outlet')
export class RouterOutlet extends LitElement {

	static override styles = css`
		:host {
			display: block;
		}

		.loading {
			padding: 20px;
			text-align: center;
			color: #666;
		}

		.error {
			padding: 20px;
			color: #d32f2f;
			background: #ffebee;
			border-radius: 4px;
		}
	`;

	@consume({ context: routerDepthContext, subscribe: true })
	@property({ type: Number })
	parentDepth = -1;

	@consume({ context: routerContext, subscribe: true })
	@property({ attribute: false })
	routerInstance: Router = router;

	@provide({ context: routerDepthContext })
	@property({ type: Number })
	currentDepth = 0;

	private routerController?: RouterController;

	override connectedCallback(): void {
		super.connectedCallback();
		// Set current depth based on parent
		this.currentDepth = this.parentDepth + 1;
		// Create controller with the appropriate depth
		this.routerController = new RouterController(this, this.routerInstance, this.currentDepth);
	}

	override render() {
		if (!this.routerController) {
			return html`<slot></slot>`;
		}

		const match: RouteMatch | null = this.routerController.match();

		if (!match) {
			return html`<slot></slot>`;
		}

		// Handle loading state
		if (match.loading) {
			return html`<div class="loading">Loading...</div>`;
		}

		// Handle error state
		if (match.error) {
			return html`
				<div class="error">
					<strong>Error:</strong> ${match.error.message}
				</div>
			`;
		}

		// Prefer template over component
		if (match.template) {
			return match.template(match.params);
		}

		// Fallback to component if no template
		if (match.component) {
			// Create and render the matched component
			const element = document.createElement(match.component);

			// Pass params as properties
			Object.entries(match.params).forEach(([ key, value ]) => {
				(element as any)[key] = value;
			});

			return element;
		}

		return html`<slot></slot>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'router-outlet': RouterOutlet;
	}
}
