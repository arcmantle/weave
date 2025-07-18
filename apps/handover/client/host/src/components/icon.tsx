import { AdapterElement, property, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, unsafeHTML } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import { requestIcon } from './icon-helpers.ts';


export class IconCmp extends AdapterElement {

	static override tagName: string = 'ho-icon';

	static parser: DOMParser;

	/** Can be set to change default behavior. */
	static mutator = (svg: SVGElement): void => {
		svg.setAttribute('fill', 'currentColor');
		svg.removeAttribute('height');
		svg.removeAttribute('width');
	};

	@property(String) accessor url: string = '';
	@property(String) accessor template: string = '';
	@state() protected accessor svg: string = '';

	override connected(): void {
		super.connected();
	}

	protected override beforeUpdate(changedProps: Map<keyof any, any>): void {
		super.beforeUpdate(changedProps);

		if (changedProps.has('url') || changedProps.has('template'))
			this.setSvg();
	}

	protected async getSvg(): Promise<string> {
		IconCmp.parser ??= new DOMParser();

		let svg = '';
		if (this.url) {
			const file = await requestIcon(this.url);
			if (!file.ok)
				return '';

			svg = file.svg;
		}
		else if (this.template) {
			svg = this.template;
		}
		else {
			return '';
		}

		const doc = IconCmp.parser.parseFromString(svg, 'text/html');
		const svgEl = doc.body.querySelector('svg');
		if (!svgEl)
			return '';

		IconCmp.mutator(svgEl);

		return svgEl.outerHTML;
	}

	protected async setSvg(): Promise<void> {
		this.svg = await this.getSvg();
	}

	protected override render(): unknown {
		return <div role="img">
			{ unsafeHTML(this.svg) }
		</div>;
	}

	static override styles: CSSStyle = css`
		:host {
			display: inline-grid;
			place-items: center;
			height: max-content;
			width: max-content;
			pointer-events: none;
		}
		div {
			contain: strict;
			box-sizing: content-box;
			display: flex;
			place-items: center;
			flex-flow: column nowrap;
		}
		div, svg {
			width: 1em;
			height: 1em;
		}
		svg {
			display: block;
		}
	`;

}


export const Icon: ToComponent<IconCmp> =
	toComponent(IconCmp);
