import { consume, createContext, provide } from '@lit/context';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { type RouteMatch, Router, router, routerContext, RouterController } from './router.js';


// Context for tracking route depth
export const routerDepthContext: ReturnType<typeof createContext<number>>
	= createContext<number>(Symbol('router-depth'));


@customElement('router-outlet')
export class RouterOutlet extends LitElement {

	@consume({ context: routerDepthContext, subscribe: true })
	@property({ type: Number })
	parentDepth = -1;

	@consume({ context: routerContext, subscribe: true })
	@property({ attribute: false })
	routerInstance: Router = router;

	@provide({ context: routerDepthContext })
	@property({ type: Number })
	currentDepth = 0;

	protected routerController?: RouterController;
	protected previousMatchPath?: string;

	override connectedCallback(): void {
		super.connectedCallback();
		// Set current depth based on parent
		this.currentDepth = this.parentDepth + 1;
		// Create controller with the appropriate depth
		this.routerController = new RouterController(this, this.routerInstance, this.currentDepth);
		// Wire exit animation callback so the router can trigger it before match changes
		this.routerController.onBeforeMatchChange = () => this.playExitAnimation();
	}

	/**
	 * After each Lit update cycle, run enter animation on the new content
	 * if the matched route specifies one.
	 */
	override updated(): void {
		this.performEnterAnimation();
	}

	protected async performEnterAnimation(): Promise<void> {
		const match = this.routerController?.match();
		if (!match?.animation?.enter)
			return;

		// Only run enter once per route change (not on every re-render).
		const matchKey = `${ match.path }:${ match.name ?? '' }`;
		if (matchKey === this.previousMatchPath)
			return;

		this.previousMatchPath = matchKey;

		const wrapper = this.shadowRoot?.querySelector('.route-content');
		if (wrapper) {
			// Cancel any lingering exit animation so the element is visible.
			wrapper.getAnimations().forEach(a => a.cancel());
			await match.animation.enter(wrapper);
		}
	}

	/**
	 * Runs the exit animation on the current content before the router
	 * swaps in the new match. Called by the router's navigate method.
	 */
	async playExitAnimation(): Promise<void> {
		const match = this.routerController?.match();
		if (!match?.animation?.exit)
			return;

		const wrapper = this.shadowRoot?.querySelector('.route-content');
		if (wrapper)
			await match.animation.exit(wrapper);
	}

	override render(): TemplateResult | Element {
		if (!this.routerController)
			return html`<slot></slot>`;

		const match: RouteMatch | null = this.routerController.match();

		if (!match)
			return html`<slot></slot>`;

		// Handle loading state
		if (match.loading)
			return html`<div class="loading">Loading...</div>`;

		// Handle error state
		if (match.error) {
			return html`
		<div class="error">
			<strong>Error:</strong> ${ match.error.message }
		</div>
			`;
		}

		// Prefer template over component
		if (match.template)
			return html`<div class="route-content">${ match.template(match.params) }</div>`;

		// Fallback to component if no template
		if (match.component) {
			// Create and render the matched component
			const element = document.createElement(match.component);

			// Pass params as properties
			Object.entries(match.params).forEach(([ key, value ]) => {
				(element as any)[key] = value;
			});

			return html`<div class="route-content">${ element }</div>`;
		}

		return html`<slot></slot>`;
	}

	static override styles: ReturnType<typeof css> = css`
		:host {
			--color-text-muted: #666;
			--color-error-text: #d32f2f;
			--color-error-bg: #ffebee;
			--spacing-md: 20px;
			--radius-sm: 4px;
			display: contents;
		}
		.route-content {
			display: grid;
			contain: strict;
			will-change: transform, opacity;
		}
		.loading {
			padding: var(--spacing-md);
			color: var(--color-text-muted);
			text-align: center;
		}
		.error {
			padding: var(--spacing-md);
			border-radius: var(--radius-sm);
			color: var(--color-error-text);
			background: var(--color-error-bg);
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'router-outlet': RouterOutlet;
	}
}
