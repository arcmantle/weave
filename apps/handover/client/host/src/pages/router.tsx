import { Router } from '@arcmantle/adapter-element/router';
import { cssreset } from '@arcmantle/handover-core/styles/css-reset.js';
import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { absenceManifest } from '../extensions/absence/manifest.tsx';
import { registerManifest, resolveManifests } from '../extensions/create-manifest.ts';
import { shopSheetManifest } from '../extensions/shop-sheet/manifest.tsx';
import { injector } from '../inject.ts';
import { EditorArea, EditorAreaService } from '../layout/editor-area.tsx';
import { PanelArea, PanelAreaService } from '../layout/panel-area.tsx';
import { PrimarySidebar, PrimarySidebarService } from '../layout/primary-sidebar.tsx';
import { SecondarySidebar, SecondarySidebarService } from '../layout/secondary-sidebar.tsx';
import { Statusbar } from '../layout/statusbar.tsx';


@customElement('ho-router')
export class RouterCmp extends LitElement {

	static tagName: string = 'ho-router';

	@state() accessor layoutState: {
		primaryPanel?:     string;
		primarySidebar?:   string;
		secondaryPanel?:   string;
		secondarySidebar?: string;
		statusbar?:        string;
	} = {};

	protected router: Router = new Router(this);

	override connectedCallback(): void {
		super.connectedCallback();

		if (!this.hasUpdated)
			this.firstConnected();

		injector.bind('primary-sidebar').class(PrimarySidebarService);
		injector.bind('secondary-sidebar').class(SecondarySidebarService);
		injector.bind('editor-area').class(EditorAreaService);
		injector.bind('panel-area').class(PanelAreaService);

		this.parseLayoutFromURL();
	}

	firstConnected(): void {
		registerManifest(shopSheetManifest);
		registerManifest(absenceManifest);
		resolveManifests();

		Router.addNavListener(() => this.parseLayoutFromURL());
	}

	protected parseLayoutFromURL(): void {
		const params = new URLSearchParams(window.location.search);
		this.layoutState = {
			primaryPanel:     params.get('pp') || undefined,
			primarySidebar:   params.get('ps') || undefined,
			secondaryPanel:   params.get('sp') || undefined,
			secondarySidebar: params.get('ss') || undefined,
		};
	}

	protected override render(): unknown {
		return <>
			<PrimarySidebar
				static
				contentLocation='editor'
				activeTemplateId={this.layoutState.primarySidebar}
				class="primary-sidebar"
			></PrimarySidebar>

			<EditorArea
				activeTemplateId={this.layoutState.primaryPanel}
				class="primary-panel"
			></EditorArea>

			<SecondarySidebar
				activeTemplateId={this.layoutState.secondarySidebar}
				class="secondary-sidebar"
			></SecondarySidebar>

			<PanelArea
				activeTemplateId={this.layoutState.secondaryPanel}
				class="secondary-panel"
			></PanelArea>

			<Statusbar class="statusbar"></Statusbar>
		</>;
	}

	static override styles: CSSResultGroup = [
		cssreset,
		css`
		:host {
			display: grid;
			height: 100dvh;

			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto 1fr auto auto;
		}
		.primary-panel {
			grid-column: 2 / span 1;
			grid-row: 2 / span 1;
		}
		.secondary-panel {
			grid-column: 2 / span 2;
			grid-row: 3 / span 1;
		}
		.primary-sidebar {
			grid-column: 1 / span 1;
			grid-row: 1 / span 3;
		}
		.secondary-sidebar {
			grid-column: 3 / span 1;
			grid-row: 2 / span 1;
		}
		.statusbar {
			grid-column: 1 / span 4;
			grid-row: 4 / span 1;
		}
		`,
	];

}


//interface SomeObject {
//	a:          string;
//	readonly b: number;
//	c?:         boolean;
//	d:          LitJSX.Mandatory<number>;
//}

//type Test = LitJSX.PartialExceptRequired<SomeObject>;
