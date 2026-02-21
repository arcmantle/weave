import { authService } from '@arcmantle/pivot-client-auth';


export interface PluginInfo {
	name:         string;
	enabled:      boolean;
	version?:     string;
	registryUrl?: string;
}


class PluginService {

	protected eventSource: EventSource | null = null;
	protected listeners:   Set<() => void> = new Set();

	async getPlugins(): Promise<PluginInfo[]> {
		const response = await authService.fetchWithAuth('/api/plugins/');
		if (!response.ok)
			throw new Error(`Failed to fetch plugins: ${ response.statusText }`);

		return await response.json();
	}

	async togglePlugin(name: string): Promise<void> {
		const response = await authService.fetchWithAuth(`/api/plugins/${ encodeURIComponent(name) }/toggle`, {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to toggle plugin: ${ response.statusText }`);
	}

	async enablePlugin(name: string): Promise<void> {
		const response = await authService.fetchWithAuth(`/api/plugins/${ encodeURIComponent(name) }/enable`, {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to enable plugin: ${ response.statusText }`);
	}

	async disablePlugin(name: string): Promise<void> {
		const response = await authService.fetchWithAuth(`/api/plugins/${ encodeURIComponent(name) }/disable`, {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to disable plugin: ${ response.statusText }`);
	}

	async deployPlugins(): Promise<{ message: string; note: string; }> {
		const response = await authService.fetchWithAuth('/api/plugins/deploy', {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to deploy plugins: ${ response.statusText }`);

		return await response.json();
	}

	async installPlugin(registryUrl: string, name: string, version: string): Promise<{ message: string; }> {
		const params = new URLSearchParams({ registryUrl, name, version });
		const response = await authService.fetchWithAuth(`/api/plugins/install?${ params }`, {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to install plugin: ${ response.statusText }`);

		return await response.json();
	}

	/** Subscribe to real-time plugin events via SSE. */
	connectEventStream(onEvent: (data: string) => void): void {
		this.disconnectEventStream();

		this.eventSource = new EventSource('/api/plugins/events');
		this.eventSource.onmessage = (event) => {
			onEvent(event.data);
		};
		this.eventSource.onerror = () => {
			// Auto-reconnect is handled by EventSource
		};
	}

	disconnectEventStream(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}

}

export const pluginService: PluginService = new PluginService();
