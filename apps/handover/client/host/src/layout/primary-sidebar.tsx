import { type DynamicCSS, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { clamp } from '@arcmantle/library/math';
import { Show, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { Activitybar } from './activitybar.tsx';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class PrimarySidebarCmp extends ContentArea {

	static override tagName:  string = 'ho-primary-sidebar';
	override contentLocation: ContentLocation = 'primary-sidebar';

	protected primarySidebar: PrimarySidebarService = this.inject.get('primary-sidebar');

	@state() accessor width: number = 200;

	override connected(): void {
		super.connected();
	}

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const activitybar = this.querySelector<HTMLElement>('.activitybar');
			if (!activitybar)
				return console.warn('Activitybar not found for resizing primary sidebar.');

			const width = ev.clientX - activitybar.getBoundingClientRect().right;

			if (width < 40 && this.primarySidebar.visible.value)
				this.primarySidebar.visible.value = false;

			if (width > 80 && !this.primarySidebar.visible.value)
				this.primarySidebar.visible.value = true;

			this.width = clamp(60, width, 600);
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
			<Activitybar class="activitybar"></Activitybar>

			<Show when={this.primarySidebar.visible.value}>
				{() => <s-wrapper>
					{this.content.render()}
				</s-wrapper>}
			</Show>

			<s-drag-handle on-mousedown={this.onWrapperMousedown}></s-drag-handle>
		</>;
	}

	protected override renderStyles(styles: string, css: DynamicCSS): string | void {
		styles += css`
			s-wrapper {
				--_width: ${ this.width }px;
			}
		`;

		return styles;
	}

	override performUpdate(): void {
		console.time('PrimarySidebarCmp#performUpdate');
		super.performUpdate();
		console.timeEnd('PrimarySidebarCmp#performUpdate');
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
			border-left: 1px solid black;
			width: var(--width, var(--_width));
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


export const PrimarySidebar: ToComponent<PrimarySidebarCmp> =
	toComponent(PrimarySidebarCmp);


export class PrimarySidebarService {

	visible: Signal<boolean> = layoutPreferences.primarySidebar.visible;

}
