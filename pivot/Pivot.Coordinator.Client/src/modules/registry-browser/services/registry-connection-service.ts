import { authService } from '@arcmantle/pivot-client-auth';

import type { RegistryConnection, RegistryPluginInfo } from '../models/registry.ts';


const STORAGE_KEY = 'pivot-coordinator-registries';


class RegistryConnectionService {

	protected connections: RegistryConnection[] = [];
	protected listeners:   Set<() => void> = new Set();

	constructor() {
		this.loadFromStorage();
	}

	getConnections(): RegistryConnection[] {
		return [ ...this.connections ];
	}

	addConnection(name: string, url: string): RegistryConnection {
		const connection: RegistryConnection = {
			id:  crypto.randomUUID(),
			name,
			url: url.replace(/\/+$/, ''),
		};

		this.connections.push(connection);
		this.saveToStorage();
		this.notifyListeners();

		return connection;
	}

	removeConnection(id: string): void {
		this.connections = this.connections.filter(c => c.id !== id);
		this.saveToStorage();
		this.notifyListeners();
	}

	async fetchPlugins(registryUrl: string): Promise<RegistryPluginInfo[]> {
		const response = await fetch(`${ registryUrl }/api/plugins`);
		if (!response.ok)
			throw new Error(`Failed to fetch plugins from ${ registryUrl }: ${ response.statusText }`);

		return await response.json();
	}

	async installFromRegistry(registryUrl: string, name: string, version: string): Promise<{ message: string; }> {
		const params = new URLSearchParams({ registryUrl, name, version });
		const response = await authService.fetchWithAuth(`/api/plugins/install?${ params }`, {
			method: 'POST',
		});
		if (!response.ok)
			throw new Error(`Failed to install plugin: ${ response.statusText }`);

		return await response.json();
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	protected loadFromStorage(): void {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored)
				this.connections = JSON.parse(stored);
		}
		catch {
			this.connections = [];
		}
	}

	protected saveToStorage(): void {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.connections));
	}

	protected notifyListeners(): void {
		for (const listener of this.listeners)
			listener();
	}

}

export const registryConnectionService: RegistryConnectionService = new RegistryConnectionService();
