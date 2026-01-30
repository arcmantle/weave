import type { Plugin, PluginListResponse } from '../models/plugin.ts';
import { authService } from './auth-service.ts';

export class PluginApiService {

	async getPlugins(params?: {
		search?:   string;
		tag?:      string;
		page?:     number;
		pageSize?: number;
	}): Promise<PluginListResponse> {
		const queryParams = new URLSearchParams();
		if (params?.search)
			queryParams.set('search', params.search);
		if (params?.tag)
			queryParams.set('tag', params.tag);
		if (params?.page)
			queryParams.set('page', params.page.toString());
		if (params?.pageSize)
			queryParams.set('pageSize', params.pageSize.toString());

		const url = `/api/plugins${ queryParams.toString() ? '?' + queryParams.toString() : '' }`;
		const response = await authService.fetchWithAuth(url);

		if (!response.ok)
			throw new Error(`Failed to fetch plugins: ${ response.statusText }`);


		return await response.json();
	}

	async getPlugin(name: string): Promise<Plugin> {
		const response = await authService.fetchWithAuth(`/api/plugins/${ encodeURIComponent(name) }`);

		if (!response.ok)
			throw new Error(`Failed to fetch plugin: ${ response.statusText }`);


		return await response.json();
	}

	async deleteVersion(pluginName: string, version: string): Promise<void> {
		const response = await authService.fetchWithAuth(
			`/api/plugins/${ encodeURIComponent(pluginName) }/versions/${ encodeURIComponent(version) }`,
			{
				method: 'DELETE',
			},
		);

		if (!response.ok)
			throw new Error(`Failed to delete plugin version: ${ response.statusText }`);
	}

	async downloadPlugin(pluginName: string, version: string): Promise<Blob> {
		const response = await authService.fetchWithAuth(
			`/api/plugins/${ encodeURIComponent(pluginName) }/versions/${ encodeURIComponent(version) }/download`,
		);

		if (!response.ok)
			throw new Error(`Failed to download plugin: ${ response.statusText }`);


		return await response.blob();
	}

	async uploadPlugin(file: File): Promise<{ message: string; plugin: string; version: string }> {
		const formData = new FormData();
		formData.append('file', file);

		const response = await authService.fetchWithAuth('/api/plugins/upload', {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || `Failed to upload plugin: ${ response.statusText }`);
		}

		return await response.json();
	}

}

export const pluginApi: PluginApiService = new PluginApiService();
