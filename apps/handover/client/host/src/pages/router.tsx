import { AdapterElement, customElement, PluginModule, provider, state } from '@arcmantle/adapter-element/adapter';
import { Router } from '@arcmantle/adapter-element/router';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { cssreset } from '@arcmantle/handover-core/styles/css-reset.js';

import { registerManifest, resolveManifests } from '../extensions/create-manifest.ts';
import { shopSheetManifest } from '../extensions/shop-sheet/manifest.tsx';
import { Activitybar } from '../layout/activitybar.tsx';
import { PrimaryPanel } from '../layout/primary-panel.tsx';
import { PrimarySidebar } from '../layout/primary-sidebar.tsx';
import { SecondaryPanel } from '../layout/secondary-panel.tsx';
import { SecondarySidebar } from '../layout/secondary-sidebar.tsx';
import { Statusbar } from '../layout/statusbar.tsx';


@provider()
@customElement('ho-router')
export class RouterCmp extends AdapterElement {

	static override modules: readonly PluginModule[] = [
		new PluginModule(({ bind }) => {
			bind('test')
				.constant('Hello world')
				.onActivation(instance => {
					console.log('test', instance);

					return instance;
				});
		}),
	];

	@state() accessor layoutState: {
		primaryPanel?:     string;
		primarySidebar?:   string;
		secondaryPanel?:   string;
		secondarySidebar?: string;
		statusbar?:        string;
	} = {};

	override firstConnected(): void {
		super.firstConnected();

		registerManifest(this.inject, shopSheetManifest);
		resolveManifests(this.inject);

		Router.addNavListener(() => this.parseLayoutFromURL());
	}

	override connected(): void {
		super.connected();

		this.parseLayoutFromURL();

		this.inject.bind('defaultSidebar').constant(<>
			Hello I am a sidebar
		</>);
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
			<Activitybar class="activitybar"></Activitybar>

			<PrimarySidebar
				activeTemplateId={this.layoutState.primarySidebar}
				class="primary-sidebar"
			></PrimarySidebar>

			<PrimaryPanel
				activeTemplateId={this.layoutState.primaryPanel}
				class="primary-panel"
			></PrimaryPanel>

			<SecondarySidebar
				activeTemplateId={this.layoutState.secondarySidebar}
				class="secondary-sidebar"
			></SecondarySidebar>

			<SecondaryPanel
				activeTemplateId={this.layoutState.secondaryPanel}
				class="secondary-panel"
			></SecondaryPanel>

			<Statusbar class="statusbar"></Statusbar>
		</>;
	}

	static override styles: CSSStyle = [
		cssreset,
		css`
		:host {
			display: grid;
			height: 100dvh;

			grid-template-columns: auto auto 1fr auto;
			grid-template-rows: auto 1fr auto auto;
		}
		.activitybar {
			grid-column: 1 / span 1;
			grid-row: 1 / span 3;
		}
		.primary-panel {
			grid-column: 3 / span 1;
			grid-row: 2 / span 1;
		}
		.secondary-panel {
			grid-column: 3 / span 2;
			grid-row: 3 / span 1;
		}
		.primary-sidebar {
			grid-column: 2 / span 1;
			grid-row: 1 / span 3;
		}
		.secondary-sidebar {
			grid-column: 4 / span 1;
			grid-row: 2 / span 1;
		}
		.statusbar {
			grid-column: 1 / span 4;
			grid-row: 4 / span 1;
		}

		/* TEMP */
		.activitybar {
			background-color: lightblue;
			border: 1px solid black;
			border-left: none;
			border-top: none;
			border-bottom: none;
			width: 50px;
		}
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
		.primary-sidebar {
			background-color: lightcyan;
			width: 200px;
			border: 1px solid black;
			border-left: none;
			border-right: none;
			border-top: none;
			border-bottom: none;
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
