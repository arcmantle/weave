import type { PluginActivator } from '@arcmantle/pivot-client-plugin';

import { WeatherPage } from './weather-page.js';


/**
 * Plugin activate function.
 * Called by the app shell when this plugin's code is loaded.
 */
export const activate: PluginActivator = (_context) => {
	console.log('[WeatherPlugin] Client activated');
};

// Named export for lazy route loading.
// The client-manifest.json references "WeatherPage" as the lazyComponent.
export { WeatherPage };
