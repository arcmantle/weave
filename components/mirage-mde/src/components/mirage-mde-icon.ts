import { type CSSResultGroup, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { requestIcon } from '../utilities/icon.js';
import iconStyles from './mirage-mde-icon.css' with { type: 'css' };


let parser: DOMParser;


@customElement('mirage-mde-icon')
export class IconElement extends LitElement {

	/** Can be set to change default behavior. */
	static mutator(svg: SVGElement): void {
		svg.setAttribute('fill', 'currentColor');
		svg.removeAttribute('height');
		svg.removeAttribute('width');
	};

	@property() url:        string;
	@state() protected svg: string;

	protected override update(props: PropertyValues): void {
		super.update(props);

		if (props.has('url'))
			this.setSvg();
	}

	protected async getSvg(): Promise<string> {
		parser ??= new DOMParser();

		const file = await requestIcon(this.url);
		if (!file.ok)
			return '';

		const doc = parser.parseFromString(file.svg, 'text/html');
		const svgEl = doc.body.querySelector('svg');
		if (!svgEl)
			return '';

		IconElement.mutator(svgEl);

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

	static override styles: CSSResultGroup = iconStyles;

}
