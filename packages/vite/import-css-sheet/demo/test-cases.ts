import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


// Test Case 1: Class with existing array styles property
@customElement('test-case-1')
export class TestCase1 extends LitElement {

	static override styles: CSSResultGroup = [
		css`
			:host { background: red; }
		`,
	];

	protected override render(): unknown {
		return html`<div>Test Case 1: Existing array</div>`;
	}

}

// Test Case 2: Class with existing non-array styles property
@customElement('test-case-2')
export class TestCase2 extends LitElement {

	static override styles: CSSResultGroup = css`
		:host { background: blue; }
	`;

	protected override render(): unknown {
		return html`<div>Test Case 2: Non-array styles</div>`;
	}

}

// Test Case 3: Class with no styles property
@customElement('test-case-3')
export class TestCase3 extends LitElement {

	protected override render(): unknown {
		return html`<div>Test Case 3: No styles property</div>`;
	}

}

// Test Case 4: Class that doesn't extend LitElement (should not be processed)
export class NotLitElement {

	static styles: CSSResultGroup = css`
		.test { color: green; }
	`;

}
