export interface RegistryConnection {
	id:   string;
	name: string;
	url:  string;
}

export interface RegistryPluginInfo {
	name:        string;
	version:     string;
	description?: string;
}
