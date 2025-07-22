import { type DynamicCSS, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { Show, type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class PanelAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-panel-area';
	override contentLocation: ContentLocation = 'panel';

	protected panelArea: PanelAreaService = this.inject.get('panel-area');

	@state() accessor height: number = 200;

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const height = this.element.getBoundingClientRect().bottom - ev.clientY;

			if (height < 40 && this.panelArea.visible.value)
				this.panelArea.visible.value = false;

			if (height > 80 && !this.panelArea.visible.value)
				this.panelArea.visible.value = true;

			this.height = height;
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
			<s-drag-handle on-mousedown={this.onWrapperMousedown}></s-drag-handle>

			<Show when={this.panelArea.visible.value}>
				{() => <s-wrapper>
				</s-wrapper>}
			</Show>
		</>;
	}

	protected override renderStyles(styles: string, css: DynamicCSS): string | void {
		styles += css`
			:host {
				--_height: ${ this.height }px;
			}
		`;

		return styles;
	}

	static override styles: CSSStyle = css`
		:host {
			position: relative;
			display: grid;

			background-color: lavenderblush;
			border-left: 1px solid black;

			--height: var(--_height);
		}
		s-wrapper {
			display: block;
			height: var(--height, var(--_height));
			max-height: 80vh;
			min-height: 60px;
			border-bottom: 1px solid black;
		}
		s-drag-handle {
			position: absolute;
			display: block;
			top: 0px;
			left: 0px;
			right: 0px;
			height: 0px;

			&::after {
				content: '';
				position: absolute;
				top: 50%;
				left: 0px;
				right: 0px;
				translate: 0% -50%;
				height: 3px;
				background-color: transparent;
				cursor: ns-resize;
				z-index: 1;
			}
			&:hover::after {
				background-color: red;
			}
		}
	`;

}


export const PanelArea: ToComponent<PanelAreaCmp> =
	toComponent(PanelAreaCmp);


export class PanelAreaService {

	visible: Signal<boolean> = layoutPreferences.panelArea.visible;

}
