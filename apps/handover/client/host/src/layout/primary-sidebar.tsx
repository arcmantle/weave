import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { Show, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { Activitybar } from './activitybar.tsx';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class PrimarySidebarCmp extends ContentArea {

	static override tagName:  string = 'ho-primary-sidebar';
	override contentLocation: ContentLocation = 'primary-sidebar';

	protected primarySidebar: PrimarySidebarService = this.inject.get('primary-sidebar');

	protected override render(): unknown {
		return <>
			<Activitybar class="activitybar"></Activitybar>

			<Show when={this.primarySidebar.visible.value}>
				{() => <s-wrapper>{this.content.render()}</s-wrapper>}
			</Show>

			<button on-click={() => this.primarySidebar.visible.value = !this.primarySidebar.visible.value}>Toggle</button>
		</>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: grid;
			grid-template-columns: 60px 1fr;

			background-color: lightcyan;
		}
		s-wrapper {
			border-left: 1px solid black;
			width: 200px;
		}
	`;

}


export const PrimarySidebar: ToComponent<PrimarySidebarCmp> =
	toComponent(PrimarySidebarCmp);


export class PrimarySidebarService {

	visible: Signal<boolean> = layoutPreferences.primarySidebar.visible;

}
