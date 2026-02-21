import type { PluginActivator } from '@arcmantle/pivot-client-plugin';

import { TodosPage } from './todos-page.js';


/**
 * Plugin activate function.
 * Called by the app shell when this plugin's code is loaded.
 */
export const activate: PluginActivator = (_context) => {
	console.log('[TodosPlugin] Client activated');
};

// Named export for lazy route loading.
export { TodosPage };
