import { AdapterElement, customElement, PluginModule, provider, state } from '@arcmantle/adapter-element/adapter';
import { Router } from '@arcmantle/adapter-element/router';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { cssreset } from '@arcmantle/handover-core/styles/css-reset.js';

import { absenceManifest } from '../extensions/absence/manifest.tsx';
import { registerManifest, resolveManifests } from '../extensions/create-manifest.ts';
import { shopSheetManifest } from '../extensions/shop-sheet/manifest.tsx';
import { EditorArea, EditorAreaService } from '../layout/editor-area.tsx';
import { PanelArea, PanelAreaService } from '../layout/panel-area.tsx';
import { PrimarySidebar, PrimarySidebarService } from '../layout/primary-sidebar.tsx';
import { SecondarySidebar, SecondarySidebarService } from '../layout/secondary-sidebar.tsx';
import { Statusbar } from '../layout/statusbar.tsx';


@provider()
@customElement('ho-router')
export class RouterCmp extends AdapterElement {

	static override modules: readonly PluginModule[] = [
		new PluginModule(({ bind }) => {
			bind('primary-sidebar').class(PrimarySidebarService);
			bind('secondary-sidebar').class(SecondarySidebarService);
			bind('editor-area').class(EditorAreaService);
			bind('panel-area').class(PanelAreaService);
		}),
	];

	@state() accessor layoutState: {
		primaryPanel?:     string;
		primarySidebar?:   string;
		secondaryPanel?:   string;
		secondarySidebar?: string;
		statusbar?:        string;
	} = {};

	protected router: Router = new Router(this);

	override firstConnected(): void {
		super.firstConnected();

		registerManifest(this.inject, shopSheetManifest);
		registerManifest(this.inject, absenceManifest);
		resolveManifests(this.inject);

		Router.addNavListener(() => this.parseLayoutFromURL());
	}

	override connected(): void {
		super.connected();

		this.parseLayoutFromURL();
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

	static override styles: CSSStyle = [
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

		/* TEMP */
		.primary-panel {
			background-color: honeydew;
			border: 1px solid black;
			border-top: none;
		}
		.secondary-panel {
			background-color: lavenderblush;
			height: 100px;
			border: 1px solid black;
			border-top: none;
			border-bottom: none;
			border-right: none;
		}

		.secondary-sidebar {
			background-color: lightgoldenrodyellow;
			width: 150px;

			border: 1px solid black;
			border-top: none;
			border-right: none;
			border-left: none;
		}
		.statusbar {
			background-color: lightgray;
			height: 30px;

			border: 1px solid black;
			border-left: none;
			border-right: none;
			border-bottom: none;
		}
		`,
	];

}
