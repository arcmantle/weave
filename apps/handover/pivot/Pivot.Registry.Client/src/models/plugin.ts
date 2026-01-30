export interface Plugin {
	id: number;
	name: string;
	description?: string;
	author?: string;
	tags?: string[]; // Array of tags
	createdAt: Date;
	versions?: PluginVersion[]; // Optional - only in detail view
	versionCount?: number; // Only in list view
	latestVersion?: string; // Only in list view
	totalDownloads?: number; // Only in list view
}

export interface PluginVersion {
	id: number;
	pluginId: number;
	version: string;
	manifestJson: string;
	storageKey: string;
	fileSize: number;
	downloadCount: number;
	uploadedAt: Date;
	plugin?: Plugin;
	dependencies: PluginDependency[];
}

export interface PluginDependency {
	id: number;
	pluginVersionId: number;
	dependencyName: string;
	versionRange: string;
	pluginVersion?: PluginVersion;
}

export interface PluginListResponse {
	plugins: Plugin[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}
