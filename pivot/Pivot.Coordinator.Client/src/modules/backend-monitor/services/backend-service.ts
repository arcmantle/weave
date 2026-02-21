import { authService } from '@arcmantle/pivot-client-auth';


export interface BackendInstance {
	name:      string;
	url:       string;
	status:    string;
	lastSeen?: string;
}


class BackendService {

	protected eventSource: EventSource | null = null;

	async getBackends(): Promise<BackendInstance[]> {
		const response = await authService.fetchWithAuth('/backends');
		if (!response.ok)
			throw new Error(`Failed to fetch backends: ${ response.statusText }`);

		return await response.json();
	}

	async reload(): Promise<void> {
		const response = await authService.fetchWithAuth('/reload', {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to reload: ${ response.statusText }`);
	}

	async checkHealth(): Promise<string> {
		const response = await fetch('/health');
		if (!response.ok)
			throw new Error(`Health check failed: ${ response.statusText }`);

		return await response.text();
	}

	/** Subscribe to real-time backend state changes via SSE. */
	connectEventStream(onEvent: (data: string) => void): void {
		this.disconnectEventStream();

		this.eventSource = new EventSource('/backends/stream');
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

export const backendService: BackendService = new BackendService();
