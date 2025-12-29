import '../components/icon.tsx';

import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { For } from '@arcmantle/lit-jsx';
import { LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import type { ContentCtor, ContentManifest } from '../extensions/create-manifest.ts';
import { injector } from '../inject.ts';


@customElement('ho-activity')
export class Activitybar extends LitElement {

	static tagName: string = 'ho-activity';

	@state() protected accessor tabs: ContentManifest[] = [];

	override connectedCallback(): void {
		super.connectedCallback();

		const availableContent = injector.getAll<ContentCtor>('content');
		this.tabs = availableContent.map(content => content.manifest);
	}

	protected override render(): unknown {
		return <>
			<s-top-actions>
				<For each={ this.tabs }>
					{({ tab }) => <button onclick={tab.onClick}>
						<ho-icon class="icon" url={tab.icon}></ho-icon>
					</button>}
				</For>
			</s-top-actions>

			<s-bottom-actions>
			</s-bottom-actions>
		</>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		}
		s-top-actions, s-bottom-actions {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			align-items: center;
		}
		s-top-actions {
			padding-top: 0.5rem;
		}
		.icon {
			padding: 0.5rem;
		}
	`;

}


declare global {
	interface HTMLElementTagNameMap {
		'ho-activity': Activitybar;
	}
}
