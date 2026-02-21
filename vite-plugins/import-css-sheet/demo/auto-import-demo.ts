import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


// This file demonstrates the auto-import functionality
// When autoImport is configured with { identifier: [['LitElement', 'styles']] }
// the plugin will automatically:
// 1. Detect that this class extends LitElement
// 2. Add an import: `import autoImportDemoStyles from './auto-import-demo.css' with { type: 'css' };`
// 3. Modify the styles property to include the imported stylesheet

@customElement('auto-import-demo')
export class AutoImportDemo extends LitElement {

	protected override render(): unknown {
		return html`
		<div class="container">
			<h1>Auto Import Demo</h1>
			<p>This component should automatically have styles imported from auto-import-demo.css</p>
		</div>
		`;
	}

	// This static property will be automatically modified by the plugin
	// to include the imported CSS stylesheet
	static override styles: CSSResultGroup = [
		css`
		:host {
			display: block;
			padding: 16px;
		}
		`,
	];

}
