import { html } from 'lit';

import { moduleRegistry } from '../../modules/module-registry.ts';
import './components/registry-browser.ts';

moduleRegistry.register({
	id:        'registry-browser',
	name:      'Registries',
	icon:      '📦',
	route:     'registries',
	component: 'registry-browser',
	template:  () => html`<registry-browser></registry-browser>`,
});
