// Plugin Manager Admin Interface
(function() {
	'use strict';

	let eventSource = null;
	const pluginGrid = document.getElementById('plugin-grid');
	const connectionStatus = document.getElementById('connection-status');
	const connectionText = document.getElementById('connection-text');

	// Initialize SSE connection
	function connectSSE() {
		eventSource = new EventSource('/api/plugins/events');

		eventSource.onopen = () => {
			console.log('SSE connection established');
			updateConnectionStatus(true);
		};

		eventSource.onmessage = (event) => {
			try {
				const plugins = JSON.parse(event.data);
				updatePluginGrid(plugins);
				updateStats(plugins);
			}
			catch (error) {
				console.error('Error parsing SSE data:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('SSE error:', error);
			updateConnectionStatus(false);

			// Reconnect after 5 seconds
			setTimeout(() => {
				if (eventSource)
					eventSource.close();

				connectSSE();
			}, 5000);
		};
	}

	// Update connection status indicator
	function updateConnectionStatus(connected) {
		if (connected) {
			connectionStatus.className = 'status-indicator';
			connectionText.textContent = 'Connected';
		}
		else {
			connectionStatus.className = 'status-indicator disconnected';
			connectionText.textContent = 'Disconnected';
		}
	}

	// Update statistics
	function updateStats(plugins) {
		const totalPlugins = plugins.length;
		const enabledPlugins = plugins.filter(p => p.isEnabled).length;
		const disabledPlugins = totalPlugins - enabledPlugins;

		document.getElementById('total-plugins').textContent = totalPlugins;
		document.getElementById('enabled-plugins').textContent = enabledPlugins;
		document.getElementById('disabled-plugins').textContent = disabledPlugins;
	}

	// Update plugin grid with new data
	function updatePluginGrid(plugins) {
		plugins.forEach(plugin => {
			const card = document.querySelector(`.plugin-card[data-plugin="${ plugin.name }"]`);
			if (!card)
				return;

			// Update toggle switch
			const toggle = card.querySelector('.plugin-toggle');
			if (toggle && toggle.checked !== plugin.isEnabled)
				toggle.checked = plugin.isEnabled;


			// Update status badge
			const statusBadge = card.querySelector('.plugin-status');
			if (statusBadge) {
				statusBadge.className = `plugin-status ${ plugin.isEnabled ? 'enabled' : 'disabled' }`;
				statusBadge.textContent = plugin.isEnabled ? '✓ Enabled' : '○ Disabled';
			}

			// Update timestamp
			const timeElement = card.querySelector('.plugin-time');
			if (timeElement) {
				const date = new Date(plugin.lastModified);
				timeElement.textContent = date.toLocaleString();
			}

			// Update card border
			card.setAttribute('data-enabled', plugin.isEnabled);
		});
	}

	// Toggle plugin state
	async function togglePlugin(pluginName, toggle) {
		// Disable toggle during request
		toggle.disabled = true;

		try {
			const response = await fetch(`/api/plugins/${ pluginName }/toggle`, {
				method:  'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok)
				throw new Error(`Failed to toggle plugin: ${ response.statusText }`);


			// SSE will update the UI automatically
			console.log(`Plugin ${ pluginName } toggled successfully`);
		}
		catch (error) {
			console.error('Error toggling plugin:', error);
			alert(`Failed to toggle plugin: ${ error.message }`);

			// Revert toggle on error
			toggle.checked = !toggle.checked;
		}
		finally {
			toggle.disabled = false;
		}
	}

	// Setup toggle event listeners
	function setupToggleListeners() {
		const toggles = document.querySelectorAll('.plugin-toggle');
		toggles.forEach(toggle => {
			toggle.addEventListener('change', (e) => {
				const pluginName = e.target.getAttribute('data-plugin');
				togglePlugin(pluginName, e.target);
			});
		});
	}

	// Initialize on page load
	document.addEventListener('DOMContentLoaded', () => {
		setupToggleListeners();
		connectSSE();
	});

	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
		if (eventSource)
			eventSource.close();
	});
})();
