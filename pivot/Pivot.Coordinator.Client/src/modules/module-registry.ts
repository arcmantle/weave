import type { TemplateResult } from 'lit';


export interface ModuleDefinition {
	/** Unique identifier for the module. */
	id:        string;
	/** Display name in the navigation. */
	name:      string;
	/** SVG icon markup or emoji for the nav item. */
	icon:      string;
	/** Route path this module is mounted at (e.g. 'plugins'). */
	route:     string;
	/** The custom element tag for the module's root component. */
	component: string;
	/** Render function for the route template. */
	template:  () => TemplateResult;
}


class ModuleRegistryService {

	protected modules:   Map<string, ModuleDefinition> = new Map();
	protected listeners: Set<() => void> = new Set();

	register(module: ModuleDefinition): void {
		this.modules.set(module.id, module);
		this.notifyListeners();
	}

	getModules(): ModuleDefinition[] {
		return [ ...this.modules.values() ];
	}

	getModule(id: string): ModuleDefinition | undefined {
		return this.modules.get(id);
	}

	onModulesChanged(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	protected notifyListeners(): void {
		this.listeners.forEach(listener => listener());
	}

}

export const moduleRegistry: ModuleRegistryService = new ModuleRegistryService();
