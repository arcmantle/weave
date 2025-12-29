import { Show } from '@arcmantle/lit-jsx';
import type { Signal } from '@preact/signals-core';
import { css, type CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { injector } from '../inject.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


@customElement('ho-panel-area')
export class PanelArea extends ContentArea {

	static tagName: string = 'ho-panel-area';

	@state() accessor height: number = 200;

	override contentLocation: ContentLocation = 'panel';
	protected panelArea:      PanelAreaService;

	override connectedCallback(): void {
		super.connectedCallback();

		this.panelArea = injector.get('panel-area');
	}

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const height = this.getBoundingClientRect().bottom - ev.clientY;

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
			<style>{this.renderStyles()}</style>

			<s-drag-handle on-mousedown={this.onWrapperMousedown}></s-drag-handle>

			<Show when={this.panelArea.visible.value}>
				{() => <s-wrapper>
				</s-wrapper>}
			</Show>
		</>;
	}

	protected renderStyles(): string | void {
		const styles = `
			:host {
				--_height: ${ this.height }px;
			}
		`;

		return styles;
	}

	static override styles: CSSResultGroup = css`
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


export class PanelAreaService {

	visible: Signal<boolean> = layoutPreferences.panelArea.visible;

}


declare global {
	interface HTMLElementTagNameMap {
		'ho-panel-area': PanelArea;
	}
}
