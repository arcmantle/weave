import './components/backend-monitor.ts';

import { html } from 'lit';

import { moduleRegistry } from '../../modules/module-registry.ts';

moduleRegistry.register({
	id:        'backend-monitor',
	name:      'Backends',
	icon:      '🖥️',
	route:     'backends',
	component: 'backend-monitor',
	template:  () => html`<backend-monitor></backend-monitor>`,
});
