export type AccessMode = 'public' | 'private';

export interface RegistryConfig {
	accessMode: AccessMode;
}

/**
 * Fetches the registry's runtime configuration from the server.
 * This is always available (no auth required) and allows the pre-built
 * client to adapt its UI based on the server's access mode.
 */
class ConfigService {

	private config: RegistryConfig | null = null;

	async getConfig(): Promise<RegistryConfig> {
		if (!this.config) {
			const response = await fetch('/api/config');
			if (!response.ok)
				throw new Error(`Failed to fetch registry config: ${ response.statusText }`);

			this.config = await response.json();
		}

		return this.config!;
	}

	async isPublic(): Promise<boolean> {
		const config = await this.getConfig();

		return config.accessMode === 'public';
	}

}

export const configService: ConfigService = new ConfigService();
