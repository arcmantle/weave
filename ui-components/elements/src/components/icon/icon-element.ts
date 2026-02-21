import { customElement, MimicElement } from '@arcmantle/lit-utilities/element';
import { css, html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { requestIcon } from './helpers.js';


@customElement('mm-icon')
export class MMIcon extends MimicElement {

	static parser: DOMParser;

	/** Can be set to change default behavior. */
	static mutator = (svg: SVGElement): void => {
		svg.setAttribute('fill', 'currentColor');
		svg.removeAttribute('height');
		svg.removeAttribute('width');
	};

	@property() url:        string;
	@property() template:   string;
	@state() protected svg: string;

	protected override update(props: PropertyValues): void {
		super.update(props);

		if (props.has('url') || props.has('template'))
			this.setSvg();
	}

	protected async getSvg(): Promise<string> {
		MMIcon.parser ??= new DOMParser();

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

		const doc = MMIcon.parser.parseFromString(svg, 'text/html');
		const svgEl = doc.body.querySelector('svg');
		if (!svgEl)
			return '';

		MMIcon.mutator(svgEl);

		return svgEl.outerHTML;
	}

	protected async setSvg(): Promise<void> {
		this.svg = await this.getSvg();
	}

	protected override render(): unknown {
		return html`
		<div role="img">
			${ unsafeHTML(this.svg) }
		</div>
		`;
	}

	static override styles = [
		css`
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
		`,
	];

}


declare global {
	interface HTMLElementTagNameMap {
		'mm-icon': MMIcon;
	}
}
