// Copyright 2024 Kristoffer Roen-Lie
// SPDX-License-Identifier: Apache-2.0

type stringliteral = string & Record<never, never>;

/**
 * A unique identifier for a binding. Can be a string or symbol.
 * Used to identify and retrieve specific bindings from the container.
 */
export type Identifier = string | symbol;

/**
 * Defines the lifetime behavior of a binding.
 * - `singleton`: Same instance returned for all resolutions
 * - `transient`: New instance created for each resolution
 */
export type Lifetimes = 'singleton' | 'transient';

/**
 * Utility type that excludes callable functions from type T.
 * Used to ensure only non-function types are accepted in certain contexts.
 */
export type PureRecord<T> = T extends CallableFunction ? never : T;


/**
 * Base interface for all binding types in the dependency injection container.
 * Contains common properties shared across different binding implementations.
 */
export interface BaseBinding {
	/** The binding type - determines how the value is created ('class', 'factory', or 'constant') */
	type:        stringliteral;
	/**
	 * A resolution of `first` denotes that the first container in the lineage with a binding will be used.
	 * A resolution of `last` denotes that the last container in the lineage with a binding will be used.
	 */
	resolution:  'first' | 'last';
	/** The value, constructor, or factory function used to create instances */
	initializer: any;
	/** Internal cache for singleton instances - stores the created instance to avoid recreating it */
	cache:       any;
	/** Lifetime management strategy - 'singleton' reuses instances, 'transient' creates new ones */
	method:      Lifetimes;
	/** Optional name for the binding to allow multiple bindings for the same identifier */
	named?:      Identifier;
	/** Optional tag used in combination with name for even more specific binding identification */
	tagged?:     Identifier;
	/** Internal identifier linking this binding to a specific module for organized loading/unloading */
	moduleId?:   Identifier;
	/** Optional post-creation hook that processes the instance before returning it */
	activator?:  (instance: any, container: PluginContainer) => any;
}

/**
 * Binding configuration for class constructors.
 * Used when registering a class that should be instantiated when resolved.
 */
export interface ClassBinding extends BaseBinding {
	type:        'class';
	initializer: new (...args: any[]) => any;
}

/**
 * Binding configuration for factory functions.
 * Used when registering a factory function that creates instances dynamically.
 *
 * @template T The type of value produced by the factory function
 */
export interface FactoryBinding<T> extends BaseBinding {
	type:        'factory';
	initializer: (container: PluginContainer) => T;
}

/**
 * Binding configuration for constant values.
 * Used when registering pre-existing instances or primitive values.
 */
export interface ConstantBinding extends BaseBinding {
	type: 'constant';
}

/**
 * Union type representing all possible binding configurations.
 * A binding can be a constant value, a class constructor, or a factory function.
 */
export type Binding =
| ConstantBinding
| ClassBinding
| FactoryBinding<any>;

/**
 * Type guard function to check if a binding is a class binding.
 *
 * @param binding The binding to check
 * @returns True if the binding is a ClassBinding
 */
export const isClassBinding = (binding: Binding): binding is ClassBinding => binding.type === 'class';

/**
 * Type guard function to check if a binding is a factory binding.
 *
 * @param binding The binding to check
 * @returns True if the binding is a FactoryBinding
 */
export const isFactoryBinding = (binding: Binding): binding is FactoryBinding<any> => binding.type === 'factory';

/**
 * Type guard function to check if a binding is a constant binding.
 *
 * @param binding The binding to check
 * @returns True if the binding is a ConstantBinding
 */
export const isConstantBinding = (binding: Binding): binding is ConstantBinding => binding.type === 'constant';


/**
 * Fluent API class for configuring the initial binding type.
 * This is the entry point for the binding configuration chain.
 *
 * @example
 * ```typescript
 * container.bind('service')
 *   .constant(myService)
 *   .singleton();
 * ```
 */
export class RegisterInitializer {

	constructor(protected binding: Binding) { }

	/** Binds a value as a constant. */
	constant<T extends ConstantBinding['initializer']>(value: T): RegisterSpecifier<T> {
		this.binding.type = 'constant';
		this.binding.initializer = value;

		return new RegisterSpecifier(this.binding);
	}

	/** Binds a value as a class, initializing it whenever it is first resolved. */
	class<T extends ClassBinding['initializer']>(ctor: T): RegisterSpecifierWithLifetime<T> {
		this.binding.type = 'class';
		this.binding.initializer = ctor;

		return new RegisterSpecifierWithLifetime(this.binding);
	}

	/** Binds a value as a factory, supplying the container for use when constructing your value. */
	factory<T>(factory: FactoryBinding<T>['initializer']): RegisterSpecifierWithLifetime<T> {
		this.binding.type = 'factory';
		this.binding.initializer = factory;

		return new RegisterSpecifierWithLifetime(this.binding);
	}

}


/**
 * Fluent API class for configuring the lifetime behavior of a binding.
 * Provides methods to set singleton or transient lifetime management.
 */
export class RegisterLifetime {

	constructor(protected binding: Binding) { }

	/**
	 * Registers the binding with a singleton lifetime.\
	 * Meaning the same instance will be returned every time it is resolved from this container.\
	 * If this is bound as a bindOnce, it will be the same instance potentially across multiple containers.
	 */
	singleton(): void {
		this.binding.method = 'singleton';
	}

	/**
	 * Registers the binding with a transient lifetime.\
	 * Meaning a new instance will be returned every time it is resolved from this container.
	 */
	transient(): void {
		this.binding.method = 'transient';
	}

}


/**
 * Fluent API class for adding naming and tagging to bindings.
 * Allows for more granular identification of bindings beyond just the identifier.
 *
 * @template T The type of the bound value
 */
export class RegisterSpecifier<T> {

	constructor(protected binding: Binding) { }

	/** Registers the binding with a name, allowing for additional granularity when resolving. */
	named(name: string): RegisterLifetimeWithActivator<T> {
		this.binding.named = name;

		return new RegisterLifetimeWithActivator(this.binding);
	}

	/** Registers the binding with a name and tag, allowing for additional granularity when resolving.  */
	tagged(name: string, tag: string): RegisterLifetimeWithActivator<T> {
		this.binding.named = name;
		this.binding.tagged = tag;

		return new RegisterLifetimeWithActivator(this.binding);
	}

	/**
	 * Registers an activator function that will be called when the binding is resolved.\
	 * This allows for additional processing or modification of the instance before it is returned.
	 */
	onActivation(activator: (instance: T, container: PluginContainer) => T): RegisterLifetime {
		this.binding.activator = activator;

		return new RegisterLifetime(this.binding);
	}

}

/**
 * Extended RegisterLifetime class that also supports activation hooks.
 * Combines lifetime management with post-creation instance processing.
 *
 * @template T The type of the bound value
 */
export class RegisterLifetimeWithActivator<T> extends RegisterLifetime {

	/**
	 * Registers an activator function that will be called when the binding is resolved.\
	 * This allows for additional processing or modification of the instance before it is returned.
	 */
	onActivation(activator: (instance: T, container: PluginContainer) => T): RegisterLifetime {
		this.binding.activator = activator;

		return new RegisterLifetime(this.binding);
	}

}

/**
 * Combined fluent API class that provides both specifier and lifetime functionality.
 * Used for class and factory bindings that support all configuration options.
 *
 * @template T The type of the bound value
 */
export class RegisterSpecifierWithLifetime<T> extends RegisterLifetimeWithActivator<T> {

	/** Registers the binding with a name, allowing for additional granularity when resolving. */
	named(name: string): RegisterLifetimeWithActivator<T> {
		this.binding.named = name;

		return new RegisterLifetimeWithActivator(this.binding);
	}

	/** Registers the binding with a name and tag, allowing for additional granularity when resolving.  */
	tagged(name: string, tag: string): RegisterLifetimeWithActivator<T> {
		this.binding.named = name;
		this.binding.tagged = tag;

		return new RegisterLifetimeWithActivator(this.binding);
	}

}


/**
 * The main dependency injection container that manages bindings and resolves dependencies.
 * Supports hierarchical container structures, multiple binding types, and module-based organization.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const container = new PluginContainer();
 * container.bind('service').class(MyService).singleton();
 * const service = container.get<MyService>('service');
 *
 * // With parent container
 * const child = new PluginContainer({ parent: container });
 *
 * // With custom default lifetime
 * const transientContainer = new PluginContainer({ defaultLifetime: 'transient' });
 * ```
 */
export class PluginContainer {

	constructor(args?: { defaultLifetime?: Lifetimes; parent?: PluginContainer; }) {
		if (!args)
			return;

		const { defaultLifetime, parent } = args;
		if (defaultLifetime)
			this.defaultLifetime = defaultLifetime;
		if (parent)
			this.parent = parent;
	}

	parent?:         PluginContainer;
	defaultLifetime: Lifetimes = 'singleton';
	scopeId:         string = '';

	readonly id: string = crypto.randomUUID();

	protected readonly bindings:             Map<Identifier, Binding[]> = new Map();
	protected readonly moduleIdToIdentifier: Map<string, Identifier[]> = new Map();

	/** Loads all bindings for a module(s) */
	load(...modules: PluginModule[]): void {
		for (const module of modules) {
			const alreadyLoaded = this.moduleIdToIdentifier.has(module.id);
			if (alreadyLoaded)
				continue;

			this.moduleIdToIdentifier.set(module.id, []);

			module.registrator({
				bind:     identifier => this.createBind(identifier, 'last', module.id),
				bindOnce: identifier => {
					if (this.exists(identifier))
						return undefined;

					return this.createBind(identifier, 'first', module.id);
				},
				rebind: identifier => {
					if (this.has(identifier))
						this.unbind(identifier);

					return this.createBind(identifier, 'last', module.id);
				},
			});
		}
	}

	/** Unbinds all bindings that were registered from a module(s). */
	unload(...modules: PluginModule[]): void {
		for (const module of modules) {
			const identifiers = this.moduleIdToIdentifier.get(module.id);
			if (!identifiers)
				continue;

			for (const identifier of identifiers) {
				const bindings = this.bindings.get(identifier);
				if (!bindings)
					continue;

				for (let i = bindings.length - 1; i >= 0; i--)
					bindings[i]!.moduleId === module.id && bindings.splice(i, 1);
			}

			this.moduleIdToIdentifier.delete(module.id);
		}
	}

	/** Starts the binding sequence for an identifier. */
	bind(identifier: Identifier): RegisterInitializer {
		return this.createBind(identifier, 'last');
	}

	/** Checks if this identifier has already been bound and only binds if it has not. */
	bindOnce(identifier: Identifier): RegisterInitializer | undefined {
		if (this.exists(identifier))
			return undefined;

		return this.createBind(identifier, 'first');
	}

	/** Unbinds all bindings for this identifier and rebinds the new binding. */
	rebind(identifier: Identifier): RegisterInitializer {
		if (this.has(identifier))
			this.unbind(identifier);

		return this.createBind(identifier, 'last');
	}

	/** Unbinds all bindings matching this identifier. */
	unbind(identifier: Identifier): void {
		this.bindings.delete(identifier);
	}

	/** Clears all bindings and references held by this container. */
	unbindAll(): void {
		this.bindings.clear();
		this.moduleIdToIdentifier.clear();
	}

	/** Returns true or false if **this** `Container` has the requested `Identifier` */
	has(identifier: Identifier): boolean {
		return this.bindings.has(identifier);
	}

	/** Returns true or false if **this** `Container` has the requested `Identifier` */
	hasNamed(identifier: Identifier, name: Identifier): boolean {
		return !!this.bindings.get(identifier)
			?.some(binding => binding.named === name);
	}

	/** Returns true or false if **this** `Container` has the requested `Identifier` */
	hasTagged(identifier: Identifier, name: Identifier, tag: Identifier): boolean {
		return !!this.bindings.get(identifier)
			?.some(binding => binding.named === name && binding.tagged === tag);
	}

	/** Returns true or false if this `Container` has the requested `Identifier` in itself or any of its parents */
	exists(identifier: Identifier): boolean {
		const [ container ] = this.getBindings(identifier);

		return !!container;
	}

	/** Returns true or false if this `Container` has the requested `Identifier` in itself or any of its parents */
	existsNamed(identifier: Identifier, name: Identifier): boolean {
		const [ container ] = this.getBindings(identifier,
			binding => binding.named === name);

		return !!container;
	}

	/** Returns true or false if this `Container` has the requested `Identifier` in itself or any of its parents */
	existsTagged(identifier: Identifier, name: Identifier, tag: Identifier): boolean {
		const [ container ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		return !!container;
	}

	/** Returns the first binding matching this identifier. */
	get<T>(identifier: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.hasOneBinding(container, bindings, identifier);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	/** Returns the value of the binding if it exists, otherwise returns undefined. */
	tryGet<T>(id: Identifier): T | undefined {
		if (!this.exists(id))
			return undefined;

		return this.get(id);
	}

	/** Returns the first binding matching this identifier and name. */
	getNamed<T>(identifier: Identifier, name: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.hasOneNamedBinding(container, bindings, identifier, name);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	/** Returns the first binding matching this identifier, name and tag. */
	getTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.hasOneTaggedBinding(container, bindings, identifier, name, tag);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	/** Returns all bindings with this identifier. */
	getAll<T>(identifier: Identifier): T[] {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.hasBindings(container, bindings, identifier);

		return this.resolveAllBindings(container, bindings);
	}

	/** Returns all bindings with this identifier or an empty array if it does not exist. */
	tryGetAll<T>(identifier: Identifier): T[] {
		if (!this.exists(identifier))
			return [];

		return this.getAll(identifier);
	}

	/** Returns all bindings with this identifier and name combination. */
	getAllNamed<T>(identifier: Identifier, name: Identifier): T[] {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.hasNamedBindings(container, bindings, identifier, name);

		return this.resolveAllBindings(container, bindings);
	}

	/** Returns all bindings with this identifier, name and tagged combination. */
	getAllTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.hasTaggedBindings(container, bindings, identifier, name, tag);

		return this.resolveAllBindings(container, bindings);
	}

	/** Returns the last binding for this identifier. */
	getLast<T>(identifier: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.hasBindings(container, bindings, identifier);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	/** Returns the last binding for this identifier and name combination. */
	getLastNamed<T>(identifier: Identifier, name: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.hasNamedBindings(container, bindings, identifier, name);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	/** Returns the last binding for this identifier, name and tag combination. */
	getLastTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.hasTaggedBindings(container, bindings, identifier, name, tag);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	protected createBind(identifier: Identifier, resolution: Binding['resolution'], moduleId?: string): RegisterInitializer {
		return new RegisterInitializer(
			this.addBinding(identifier, undefined, resolution, this.defaultLifetime, 'constant', moduleId),
		);
	}

	protected addBinding(
		identifier: Identifier,
		initializer: Binding['initializer'],
		resolution: Binding['resolution'],
		method: Binding['method'],
		type: Binding['type'],
		moduleId?: string,
	): Binding {
		const bindings = this.bindings.get(identifier)
			?? this.bindings.set(identifier, []).get(identifier)!;

		const binding: Binding = { method, type, initializer, resolution, moduleId, cache: undefined };
		bindings.push(binding);

		if (moduleId) {
			const moduleIdentifiers = this.moduleIdToIdentifier.get(moduleId);
			moduleIdentifiers?.push(identifier);
		}

		return binding;
	}

	protected getBindings(
		identifier: Identifier,
		filter?: (binding: Binding) => boolean,
	): readonly [PluginContainer | undefined, Binding[]] {
		let container: PluginContainer | undefined = this.getFirstContainerWithBindings(identifier, this);
		let bindings: Binding[] = container?.bindings.get(identifier) ?? [];

		// Here we have the bindings and the container that holds them.
		// We need to check if they are all using the same resolution.
		// If not, something is wrong and we should throw an error.
		if (bindings.map(b => b.resolution).some((v, i, a) => v !== a[0]))
			throw new Error('Multiple resolution types found for ' + String(identifier));

		const resolution = bindings[0]?.resolution;
		if (resolution === 'first') {
			const newContainer = this.getLastContainerWithBindings(identifier, container);
			if (newContainer && container !== newContainer) {
				container = newContainer;
				bindings = container.bindings.get(identifier)!;
			}
		}

		if (filter)
			bindings = bindings.filter(filter);

		return bindings.length
			? [ container, bindings ] as const
			: [ undefined, bindings ] as const;
	}

	protected getFirstContainerWithBindings(
		identifier: Identifier, container?: PluginContainer,
	): PluginContainer | undefined {
		while (container) {
			if (container.bindings.has(identifier))
				return container;

			container = container.parent;
		}
	}

	protected getLastContainerWithBindings(
		identifier: Identifier, container?: PluginContainer,
	): PluginContainer | undefined {
		let lastContainer: PluginContainer | undefined = undefined;
		while (container) {
			if (container.bindings.has(identifier))
				lastContainer = container;

			container = container.parent;
		}

		return lastContainer;
	}

	protected resolveSingleBinding(container: PluginContainer, binding: Binding): any {
		let instance: any;

		if (binding.method === 'transient') {
			instance = container.resolveBinding(binding);
		}
		else if (binding.method === 'singleton') {
			if (!binding?.cache)
				binding.cache = container.resolveBinding(binding);

			instance = binding.cache;
		}

		return instance;
	}

	protected resolveAllBindings(container: PluginContainer, bindings: Binding[]): any {
		return bindings.map(binding => this.resolveSingleBinding(container, binding));
	}

	protected resolveBinding(binding: Binding): any {
		let instance: any;

		if (isConstantBinding(binding))
			instance = binding.initializer;
		else if (isClassBinding(binding))
			instance = new binding.initializer(this);
		else if (isFactoryBinding(binding))
			instance = binding.initializer(this);
		else
			throw new Error('Unsupported binding type: ' + (binding as Binding).type);

		// Apply activation if defined
		if (binding.activator)
			instance = binding.activator(instance, this);

		return instance;
	}

}


class AssertInjector {

	static hasBindings(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error('No bindings found for ' + String(id));
	}

	static hasNamedBindings(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier, name: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error(`No named bindings found for ${ String(id) } with name ${ String(name) }`);
	}

	static hasTaggedBindings(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier, name: Identifier, tag: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error(`No tagged bindings found for ${ String(id) } with name ${ String(name) } and tag ${ String(tag) }`);
	}

	static hasOneBinding(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier,
	): asserts container {
		if (container && bindings.length === 1)
			return;

		this.hasBindings(container, bindings, id);
		throw new Error('Multiple bindings found for ' + String(id));
	}

	static hasOneNamedBinding(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier, name: Identifier,
	): asserts container {
		if (container && bindings.length === 1)
			return;

		this.hasNamedBindings(container, bindings, id, name);
		throw new Error(`Multiple named bindings found for ${ String(id) } with name ${ String(name) }`);
	}

	static hasOneTaggedBinding(
		container: PluginContainer | undefined, bindings: Binding[], id: Identifier, name: Identifier, tag: Identifier,
	): asserts container {
		if (container && bindings.length === 1)
			return;

		this.hasTaggedBindings(container, bindings, id, name, tag);
		throw new Error(`Multiple tagged bindings found for ${ String(id) } with name ${ String(name) } and tag ${ String(tag) }`);
	}

}


/**
 * A module that encapsulates related dependency bindings.
 * Modules provide a way to organize and group related bindings together,
 * making them easier to manage, load, and unload as a unit.
 *
 * @example
 * ```typescript
 * const databaseModule = new PluginModule(({ bind, bindOnce, rebind }) => {
 *   bind('connection').factory(() => createConnection()).singleton();
 *   bind('repository').class(UserRepository).singleton();
 * });
 *
 * container.load(databaseModule);
 * ```
 */
export class PluginModule {

	readonly id: string = crypto.randomUUID();
	constructor(public registrator: (params: {
		bind:     PluginContainer['bind'];
		bindOnce: PluginContainer['bindOnce'];
		rebind:   PluginContainer['rebind'];
	}) => void) { }

}
