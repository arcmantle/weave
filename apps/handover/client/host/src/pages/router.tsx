import { AdapterElement, customElement, PluginModule, provider } from '@arcmantle/adapter-element/adapter';
import { Router } from '@arcmantle/adapter-element/router';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { cssreset } from '@arcmantle/handover-core/styles/css-reset.js';
import type { ToTag } from '@arcmantle/lit-jsx';


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

	protected routes: Router = new Router(this, [
		{
			path:   '/',
			render: () => (<></>),
		},
		{
			path:  '/badge',
			enter: async () => {
				return (await import('./badge-page.tsx')).BadgePageCmp.tagName;
			},
			render: (params, Page: ToTag) => <Page />,
		},
		{
			path:  '/button',
			enter: async (params) => {
				return (await import('./button-page.tsx')).ButtonPageCmp.tagName;
			},
			render: (params, Page: ToTag) => <Page />,

		},
	]);

	override connected(): void {
		super.connected();

		//console.log(this.inject);
		//const result = this.inject.get('test');
		//console.log({ result });
	}

	protected override render(): unknown {
		return this.routes.outlet();
	}

	static override styles: CSSStyle = [
		cssreset,
		css`
		:host {
			display: grid;
			height: 100dvh;
		}
		`,
	];

}
