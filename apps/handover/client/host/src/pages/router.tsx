import { AdapterElement, customElement, PluginModule, provider } from '@arcmantle/adapter-element/adapter';
import { Router } from '@arcmantle/adapter-element/router';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { toTag } from '@arcmantle/lit-jsx';

import { cssreset } from '../styles/css-reset.ts';
import { BadgePage } from './badge-page.tsx';


const Wrapper = toTag('a');

console.log(BadgePage.tag);


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
			path:   '/badge',
			render: () => <BadgePage.tag />,
		},
		{
			path:   '/rest',
			render: () => (<div {...{ name: '1', role: 'button' }} />),
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
