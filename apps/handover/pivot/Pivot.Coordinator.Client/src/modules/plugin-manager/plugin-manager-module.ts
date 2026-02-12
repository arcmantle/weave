import { html } from 'lit';

import { moduleRegistry } from '../../modules/module-registry.ts';
import './components/plugin-manager.ts';

moduleRegistry.register({
	id:        'plugin-manager',
	name:      'Plugins',
	icon:      '🧩',
	route:     'plugins',
	component: 'plugin-manager',
	template:  () => html`<plugin-manager></plugin-manager>`,
});
