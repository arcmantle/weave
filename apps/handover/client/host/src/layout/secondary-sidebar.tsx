import { Signal } from '@preact/signals-core';
import { css, type CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { injector } from '../inject.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


@customElement('ho-secondary-sidebar')
export class SecondarySidebar extends ContentArea {

	static tagName: string = 'ho-secondary-sidebar';

	@state() accessor width: number = 200;

	override contentLocation:   ContentLocation = 'secondary-sidebar';
	protected secondarySidebar: SecondarySidebarService;

	override connectedCallback(): void {
		super.connectedCallback();

		this.secondarySidebar = injector.get('secondary-sidebar');
	}

	protected onWrapperMousedown(ev: MouseEvent): void {
		ev.preventDefault();

		const mousemove = (ev: MouseEvent): void => {
			const width = this.getBoundingClientRect().right - ev.clientX;

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
			<style>{this.renderStyles()}</style>

			<s-drag-handle
				on-mousedown={this.onWrapperMousedown}
			></s-drag-handle>

			<s-wrapper>
			</s-wrapper>
		</>;
	}

	protected renderStyles(): string | void {
		const styles = `
			:host {
				--_width: ${ this.width }px;
			}
		`;

		return styles;
	}

	static override styles: CSSResultGroup = css`
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


export class SecondarySidebarService {

	visible: Signal<boolean> = layoutPreferences.secondarySidebar.visible;

}


declare global {
	interface HTMLElementTagNameMap {
		'ho-secondary-sidebar': SecondarySidebar;
	}
}
