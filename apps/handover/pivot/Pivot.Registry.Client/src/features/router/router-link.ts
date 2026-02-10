import { consume } from '@lit/context';
import { css, type CSSResultGroup, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { type NavigationOptions, Router, router, routerContext, RouterController } from './router.ts';

@customElement('router-link')
export class RouterLink extends LitElement {

	@property({ type: String }) to = '';
	@property({ type: String }) name = '';
	@property({ type: Boolean }) replace = false;
	@property({ type: String }) activeClass = 'active';
	@property({ type: Object }) query?: Record<string, string>;
	@property({ type: String }) hash?:  string;

	@consume({ context: routerContext, subscribe: true })
	@property({ attribute: false })
	routerInstance: Router = router;

	protected routerController?: RouterController;

	override connectedCallback(): void {
		super.connectedCallback();
		this.routerController = new RouterController(this, this.routerInstance);
	}

	protected async handleClick(e: Event): Promise<void> {
		e.preventDefault();

		if (!this.routerController)
			return;

		const options: NavigationOptions = {
			replace: this.replace,
			query:   this.query,
			hash:    this.hash,
		};

		if (this.name)
			await this.routerController.navigateByName(this.name, options);

		else
			await this.routerController.navigate(this.to, options);
	}

	override render(): TemplateResult {
		if (!this.routerController)
			return html`<slot></slot>`;


		const currentPath = this.routerController.getCurrentPath();
		const href = this.name ? '#' : this.to;
		const isActive = currentPath === this.to;
		const className = isActive ? this.activeClass : '';

		return html`
			<a href="${ href }" class="${ className }" @click="${ this.handleClick }">
				<slot></slot>
			</a>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: inline;
		}
		a {
			color: inherit;
			text-decoration: inherit;
		}
		a.active {
			font-weight: bold;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'router-link': RouterLink;
	}
}
