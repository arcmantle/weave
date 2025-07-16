import { iterate } from '@arcmantle/library/iterators';
import { type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import { MirageMDE } from '../mirage-mde.js';
import type { StatusBarItem } from '../registry/status-registry.js';
import statusBarStyles from './mirage-mde-statusbar.css' with { type: 'css' };


@customElement('mirage-mde-statusbar')
export class StatusbarElement extends LitElement {

	@property({ type: Object }) scope: MirageMDE;

	@state() protected items: StatusBarItem[] = [];

	create(): void {
		this.items = iterate(this.scope.registry.status)
			.pipe(([ name, item ]) => {
				if (this.scope.statusbar.includes(name))
					return item;
			})
			.toArray();
	}

	protected override render(): unknown {
		if (!this.scope)
			return;

		return map(this.items, (item) => html`
		<span>
			${ when(item.css, () => html`
			<style>
				${ item.css?.(item, this.scope.editor, this.scope) }
			</style>
			`) }
			${ unsafeHTML(item.template(item, this.scope.editor, this.scope)) }
		</span>
		`);
	}

	static override styles: CSSResultGroup = statusBarStyles;

}


declare global {
	interface HTMLElementTagNameMap {
		'mirage-mde-statusbar': StatusbarElement;
	}
}
