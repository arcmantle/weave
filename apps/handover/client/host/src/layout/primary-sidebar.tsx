import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { Show } from '@arcmantle/lit-jsx';
import { customElement, state } from 'lit/decorators.js';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { injector } from '../inject.ts';
import { Activitybar } from './activitybar.tsx';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


@customElement('ho-primary-sidebar')
export class PrimarySidebar extends ContentArea {

	static tagName: string = 'ho-primary-sidebar';

	@state() protected accessor width: number = 200;

	override contentLocation: ContentLocation = 'primary-sidebar';

	protected primarySidebar: PrimarySidebarService;

	override connectedCallback(): void {
		super.connectedCallback();

		this.primarySidebar = injector.get('primary-sidebar');
	}

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const activitybar = this.renderRoot.querySelector<Activitybar>(Activitybar.tagName);
			if (!activitybar)
				return console.warn('Activitybar not found for resizing primary sidebar.');

			const width = ev.clientX - activitybar.getBoundingClientRect().right;

			if (width < 40 && this.primarySidebar.visible.value)
				this.primarySidebar.visible.value = false;

			if (width > 80 && !this.primarySidebar.visible.value)
				this.primarySidebar.visible.value = true;

			this.width = width;
		};
		const mouseup = (ev: MouseEvent): void => {
			document.removeEventListener('mousemove', mousemove);
			document.removeEventListener('mouseup', mouseup);
		};

		document.addEventListener('mousemove', mousemove);
		document.addEventListener('mouseup', mouseup);
	}

	protected override render(): unknown {
		return <>
			<style>{this.renderStyles()}</style>

			<ho-activity class="activitybar"></ho-activity>

			<Show when={this.primarySidebar.visible.value}>
				{() => <s-wrapper>
					{this.content?.render()}
				</s-wrapper> }
			</Show>

			<s-drag-handle onmousedown={this.onWrapperMousedown}></s-drag-handle>
		</>;
	}

	protected renderStyles(): string | void {
		const styles = `
			s-wrapper {
				--_width: ${ this.width }px;
			}
		`;

		return styles;
	}

	static override styles: CSSStyle = css`
		:host {
			position: relative;
			display: grid;
			grid-template-columns: 60px 1fr;

			background-color: lightcyan;
			border-bottom: 1px solid black;

			--width: var(--_width);
		}
		s-wrapper {
			display: block;
			width: var(--_width, var(--width));
			max-width: 40vw;
			min-width: 60px;
			border-left: 1px solid black;
		}
		s-drag-handle {
			position: absolute;
			display: block;
			top: 0px;
			bottom: 0px;
			right: 0px;
			width: 0px;

			&::after {
				content: '';
				position: absolute;
				top: 0px;
				bottom: 0px;
				right: 50%;
				translate: 50%;
				width: 3px;
				background-color: transparent;
				cursor: ew-resize;
				z-index: 1;
			}
			&:hover::after {
				background-color: red;
			}
		}
	`;

}


export class PrimarySidebarService {

	visible: Signal<boolean> = layoutPreferences.primarySidebar.visible;

}


declare global {
	interface HTMLElementTagNameMap {
		'ho-primary-sidebar': PrimarySidebar;
	}
}
