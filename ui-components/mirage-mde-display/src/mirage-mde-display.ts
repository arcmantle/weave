import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { codeDarkStyles } from './styles/code-dark.ts';
import { markdownStyles } from './styles/markdown.ts';
import { markdownTokens } from './styles/markdown-tokens.ts';


@customElement('mirage-mde-display')
export class DisplayElement extends LitElement {

	@property({ reflect: true }) theme: 'light' | 'dark' = 'dark';
	@property() content = '';
	@property() styles = '';

	protected override render(): unknown {
		return html`
		<div
			part="markdown-body"
			class=${ classMap({ 'markdown-body': true, [this.theme]: true }) }
		>
			${ unsafeHTML(this.content) }
		</div>

		<style>${ this.styles }</style>
		`;
	}

	static override styles: CSSResultGroup = [
		markdownTokens,
		markdownStyles,
		codeDarkStyles,
		css`
		:host, * {
			box-sizing: border-box;
		}
		:host {
			display: grid;
		}
		.markdown-body {
			padding: 4px;
			word-break: break-word;
		}
		`,
	];

}


declare global {
	interface HTMLElementTagNameMap {
		'mirage-mde-display': DisplayElement;
	}
}
