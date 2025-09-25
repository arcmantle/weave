import { type DynamicCSS, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class SecondarySidebarCmp extends ContentArea {

	static override tagName:  string = 'ho-secondary-sidebar';
	override contentLocation: ContentLocation = 'secondary-sidebar';

	protected secondarySidebar: SecondarySidebarService = this.inject.get('secondary-sidebar');

	@state() accessor width: number = 200;

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const width = this.element.getBoundingClientRect().right - ev.clientX;

			if (width < 40 && this.secondarySidebar.visible.value)
				this.secondarySidebar.visible.value = false;

			if (width > 80 && !this.secondarySidebar.visible.value)
				this.secondarySidebar.visible.value = true;

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
		if (!this.secondarySidebar.visible.value)
			return;

		return <>
			<s-drag-handle
				on-mousedown={this.onWrapperMousedown}
			></s-drag-handle>

			<s-wrapper>
			</s-wrapper>
		</>;
	}

	protected override renderStyles(styles: string, css: DynamicCSS): string | void {
		styles += css`
			:host {
				--_width: ${ this.width }px;
			}
		`;

		return styles;
	}

	static override styles: CSSStyle = css`
		:host {
			position: relative;
			display: grid;

			background-color: lightgoldenrodyellow;

			--width: var(--_width);
		}
		s-wrapper {
			display: block;
			width: var(--width, var(--_width));
			max-width: 40vw;
			min-width: 60px;
			border-left: 1px solid black;
			border-bottom: 1px solid black;
		}
		s-drag-handle {
			position: absolute;
			display: block;
			top: 0px;
			bottom: 0px;
			left: 0px;
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


export const SecondarySidebar: ToComponent<SecondarySidebarCmp> =
	toComponent(SecondarySidebarCmp);


export class SecondarySidebarService {

	visible: Signal<boolean> = layoutPreferences.secondarySidebar.visible;

}
