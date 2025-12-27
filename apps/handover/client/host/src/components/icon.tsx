import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { requestIcon } from './icon-helpers.ts';


@customElement('ho-icon')
export class Icon extends LitElement {

	static tagName: string = 'ho-icon';
	static parser:  DOMParser;

	/** Can be set to change default behavior. */
	static mutator = (svg: SVGElement): void => {
		svg.setAttribute('fill', 'currentColor');
		svg.removeAttribute('height');
		svg.removeAttribute('width');
	};

	@property() accessor url: string = '';
	@property() accessor template: string = '';
	@state() protected accessor svg: string = '';

	protected override willUpdate(changedProps: Map<keyof any, any>): void {
		super.willUpdate(changedProps);

		if (changedProps.has('url') || changedProps.has('template'))
			this.setSvg();
	}

	protected async getSvg(): Promise<string> {
		Icon.parser ??= new DOMParser();

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

		const doc = Icon.parser.parseFromString(svg, 'text/html');
		const svgEl = doc.body.querySelector('svg');
		if (!svgEl)
			return '';

		Icon.mutator(svgEl);

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

	static override styles: CSSResultGroup = css`
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
