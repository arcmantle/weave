import { PluginContainer, PluginModule } from '@arcmantle/injector';
import { traverseDomUp } from '@arcmantle/library/dom';
import type { Writeable } from '@arcmantle/library/types';
import { render, type RenderOptions } from 'lit-html';

import { type CSSStyle, getInheritanceFlatStyles } from '../shared/css.ts';
import { effect } from '../shared/effect.ts';
import type { ReactiveController, ReactiveControllerHost } from '../shared/reactive-controller.ts';
import type { AdapterMetadata } from './types.ts';


// Ensure metadata is enabled. TypeScript does not polyfill
// Symbol.metadata, so we must ensure that it exists.
(Symbol as { metadata: symbol; }).metadata ??= Symbol('metadata');


export class AdapterBase extends HTMLElement {

	declare ['constructor']: typeof AdapterBase;

	protected static adapter: typeof AdapterElement;

	constructor() {
		super();

		this.createRenderRoot();
	}

	readonly renderRoot: ShadowRoot | HTMLElement;
	readonly adapter:    AdapterElement;

	protected __attrCtrl: MutationObserver | undefined;
	adapterInitialized:   boolean = false;
	pluginContainer:      PluginContainer;

	protected createRenderRoot(): void {
		this.attachShadow({ mode: 'open' });
		(this as Writeable<this>).renderRoot = this.shadowRoot!;

		const base = this.constructor as any as typeof AdapterBase;
		const metadata = base.adapter.metadata;

		metadata.styles = getInheritanceFlatStyles('styles', base.adapter);
		this.shadowRoot!.adoptedStyleSheets = metadata.styles;

		// We need to store whatever is being assigned while the adapter is being initialized.

		// We need to set up the adapter and the properties.
		for (const prop of Object.values(metadata.propertyMetadata)) {
			Object.defineProperty(this, prop.propName, {
				get(this: AdapterBase) {
					return this.adapter?.[prop.propName as keyof AdapterElement];
				},
				set(this: AdapterBase, value) {
					if (!this.adapterInitialized)
						prop.initialValue = value;
					else
						(this.adapter as Record<keyof any, any>)[prop.propName] = value;
				},
			});
		}

		if (metadata.observedAttributes)
			this.__attrCtrl = new MutationObserver(this.observeAttributes.bind(this));
	}

	protected connectedCallback(): void {
		// Marks this as a web component.
		// Can be used to identify a wc from a regular HTMLElement.
		this.setAttribute('data-wc', '');

		this.connectAdapter();
	}

	protected disconnectedCallback(): void { this.disconnectAdapter(); }

	protected resolveContainer(): PluginContainer | Promise<PluginContainer> {
		let container = traverseDomUp<PluginContainer>(this, (node, stop) => {
			if (!(node instanceof AdapterBase))
				return;

			const base = node.constructor as any as typeof AdapterBase;
			const metadata = base.adapter.metadata;

			const container = metadata.pluginContainer;
			if (container instanceof PluginContainer)
				stop(container);
		});

		if (!container) {
			const base = this.constructor as any as typeof AdapterBase;
			const metadata = base.adapter.metadata;
			metadata.pluginContainer = container = new PluginContainer();

			console.warn(
				'No plugin container found in the DOM, '
				+ 'creating a new one for element:',
				this.tagName,
			);
		}

		return container;
	}

	protected async connectAdapter(): Promise<void> {
		const base = this.constructor as any as typeof AdapterBase;
		const metadata = base.adapter.metadata;

		// One time setup of the adapter.
		if (!this.adapterInitialized) {
			// Resolve the plugin container.
			this.pluginContainer = await this.resolveContainer();
			base.adapter.modules.forEach(module => this.pluginContainer.load(module));

			(this as Writeable<this>).adapter = new base.adapter();
			(this.adapter as any).__element = new WeakRef(this);

			this.adapterInitialized = true;

			// Set the props that were assigned before the adapter was initialized.
			// This is done after the initialized flag as the setter has a check to only
			// set the value if the adapter is initialized.
			for (const prop of Object.values(metadata.propertyMetadata))
				(this as Record<keyof any, any>)[prop.propName] = prop.initialValue;
		}

		// Set the initial values of the attribute properties.
		metadata.observedAttributes?.forEach(attr => {
			if (!this.hasAttribute(attr))
				return;

			const value = this.getAttribute(attr) ?? '';
			this.attributeChanged(attr, value);
		});

		// Observe the attributes for changes.
		this.__attrCtrl?.observe(this, {
			attributes:      true,
			attributeFilter: metadata.observedAttributes,
		});

		// If this is the first time the adapter has connected,
		// call the firstConnected method.
		if (!this.adapter.hasConnected)
			this.adapter.firstConnected();

		// Call the connected method on the adapter.
		this.adapter.connected();
	}

	protected disconnectAdapter(): void {
		// First clean up anything that may react to changes.
		this.__attrCtrl?.disconnect();

		// Then clean up the adapter.
		this.adapter?.disconnected();
	}

	protected observeAttributes(entries: MutationRecord[]): void {
		entries.forEach(entry => {
			const name = entry.attributeName;
			if (!name)
				return;

			const target = entry.target as HTMLElement;
			if (!(target instanceof HTMLElement))
				return;

			this.attributeChanged(
				name,
				target.getAttribute(entry.attributeName)!,
			);
		});
	};

	protected attributeChanged(name: string, value: string): void {
		const base = this.constructor as any as typeof AdapterBase;
		const metadata = base.adapter.metadata;

		const propMeta = metadata.propertyMetadata?.[name];
		if (!propMeta)
			return void console.warn(`Unknown attribute: ${ name }`);

		const adapter = this.adapter;
		if (!adapter)
			return;

		const type = propMeta.type;
		let convertedValue: any;

		if (type === Boolean)
			convertedValue = value === 'true' || value === '';
		else if (type === String)
			convertedValue = value || '';
		else if (type === Number)
			convertedValue = Number(value);
		else if (type === Object)
			convertedValue = JSON.parse(value);

		convertedValue = convertedValue ?? undefined;

		if (adapter[propMeta.propName as keyof AdapterElement] !== convertedValue)
			(adapter as any)[propMeta.propName] = convertedValue;
	}

}


export const adapterBase: { value: typeof AdapterBase; } = { value: AdapterBase };


export class AdapterElement implements ReactiveControllerHost {

	declare ['constructor']: typeof AdapterElement;

	static readonly tagName: string;

	static register(): void {
		if (globalThis.customElements.get(this.tagName))
			return;

		// We create a new class that extends the base element class.
		// The newly created class sets the this class as the adapter.
		const cls = this.createElementClass(this);

		if (!this.tagName)
			throw new Error('AdapterElement must have a static tagName property.');

		if (!globalThis.customElements.get(this.tagName))
			globalThis.customElements.define(this.tagName, cls);
	}

	static createElementClass(adapterClass: typeof AdapterElement): typeof AdapterBase {
		const cls = class extends adapterBase.value {

			protected static override adapter = adapterClass;

		};

		Object.defineProperty(cls, 'name', {
			value: adapterClass.tagName.replaceAll('-', '_'),
		});

		return cls;
	}

	declare static [Symbol.metadata]: AdapterMetadata;
	static get metadata(): AdapterMetadata {
		const metadata = (this[Symbol.metadata] ??= {} as any);
		metadata.observedAttributes ??= [];
		metadata.propertyMetadata   ??= {};
		metadata.signalProps        ??= [];
		metadata.changedProps       ??= new Map();
		metadata.previousProps      ??= new Map();

		return metadata;
	}

	static readonly modules: readonly PluginModule[] = [];

	/**
	 * A weak reference to the AdapterProxy element that is managing this adapter.\
	 * This is used to avoid potential memory leaks from locking a direct reference.\
	 * For internal use only.
	 */
	private __element:         WeakRef<AdapterBase>;
	private __unsubEffect?:    () => void;
	private __resolveUpdate?:  ((bool: true) => void) & { stamp: number; };
	private __controllers:     Set<ReactiveController> = new Set();
	private __eventListeners?: Map<string, Set<{
		type:     string;
		listener: EventListenerOrEventListenerObject;
		options?: boolean | AddEventListenerOptions;
	}>>;

	readonly hasConnected:   boolean = false;
	readonly hasUpdated:     boolean = false;
	readonly updateComplete: Promise<boolean> = Promise.resolve(true);
	get element(): AdapterBase {
		const element = this.__element.deref();
		if (!element)
			throw new Error('Element reference has been lost...');

		return element;
	}

	protected readonly renderOptions?: RenderOptions;

	//#region component-lifecycle
	/** Called first time this instance of the element is connected to the DOM. */
	firstConnected(): void {
		(this.hasConnected as boolean) = true;
	}

	/** Called every time this instance of the element is connected to the DOM. */
	connected(): void {
		// We utilize a WeakRef to avoid a potential leak from
		// locking a direct reference to the instance in this scope.
		const ref = new WeakRef(this);

		// Using an external function avoids mistakenly binding the current scope
		// into the effect, which would cause it to have issues being garbage collected.
		this.__unsubEffect = effect(effectReaction.bind(undefined, ref));

		for (const controller of this.__controllers)
			controller.hostConnected?.();
	}

	/** Called after a setTimeout of 0 after the render method. */
	afterConnected(): void {
	}

	disconnected(): void {
		this.__unsubEffect?.();
		this.__unsubEffect = undefined;

		this.__eventListeners?.forEach((listeners, type) => {
			for (const { listener, options } of listeners)
				this.removeEventListener(type, listener, options);
		});

		this.__eventListeners?.clear();

		for (const controller of this.__controllers)
			controller.hostDisconnected?.();
	}

	protected beforeUpdate(changedProps: Map<keyof any, any>): void {
		for (const controller of this.__controllers)
			controller.hostUpdate?.();
	}

	protected render(): unknown {
		return;
	};

	protected afterUpdate(changedProps: Map<keyof any, any>): void {
		for (const controller of this.__controllers)
			controller.hostUpdated?.();
	}
	//#endregion component-lifecycle

	private __populateChangedProps(): void {
		const base = this.constructor as any as typeof AdapterElement;
		const metadata = base.metadata;

		for (const prop of metadata.signalProps ?? []) {
			const value = this[prop as keyof typeof this];
			const previous = metadata.previousProps.get(prop);

			if (previous !== value) {
				metadata.changedProps.set(prop, previous);
				metadata.previousProps.set(prop, value);
			}
		}
	}

	private __setPendingUpdate(stamp: number): void {
		const { promise, resolve } = Promise.withResolvers<boolean>();
		(this as Writeable<this>).updateComplete = promise;

		this.__resolveUpdate = Object.assign(resolve, { stamp });
	}

	private __performUpdate(stamp: number): void {
		if (this.__resolveUpdate?.stamp !== stamp)
			return;

		const base = this.constructor as any as typeof AdapterElement;
		const metadata = base.metadata;

		this.beforeUpdate(metadata.changedProps);

		const element = this.__element.deref();
		if (!element)
			return console.warn('Element reference has been lost.');

		render(
			this.render(),
			element.renderRoot,
			this.renderOptions ?? { host: this },
		);

		// We need to wait for the next frame to ensure the DOM has been updated.
		queueMicrotask(() => {
			this.afterUpdate(metadata.changedProps);
			metadata.changedProps.clear();

			if (!this.hasUpdated) {
				(this.hasUpdated as boolean) = true;
				this.afterConnected();
			}
		});

		// Resolve the promise and clear the resolve function.
		this.__resolveUpdate = void this.__resolveUpdate?.(true);
	}

	static styles: CSSStyle;

	//#region consumer-api
	/** Retrieves a bound value from the dependency injection container. */
	get inject(): PluginContainer {
		const element = this.element;

		return element.pluginContainer;
	}

	addController(controller: ReactiveController): void {
		this.__controllers.add(controller);

		if (this.hasConnected)
			controller.hostConnected?.();
	}

	removeController(controller: ReactiveController): void {
		this.__controllers.delete(controller);
	}

	/** Queues up a render to be performed on the next microtask. */
	requestUpdate(): Promise<boolean> {
		this.__populateChangedProps();

		if (this.__resolveUpdate)
			return this.updateComplete;


		const stamp = performance.now();
		this.__setPendingUpdate(stamp);

		queueMicrotask(() => this.__performUpdate(stamp));

		return this.updateComplete;
	}

	/**
	 * Immediately resolves the queued render if there is one,
	 * or queues a new render and immediately resolves it.
	 */
	performUpdate(): Promise<boolean> {
		this.__populateChangedProps();

		if (this.__resolveUpdate) {
			this.__resolveUpdate.stamp = performance.now();
			this.__performUpdate(this.__resolveUpdate.stamp);
		}
		else {
			const stamp = performance.now();
			this.__setPendingUpdate(stamp);
			this.__performUpdate(stamp);
		}

		return this.updateComplete;
	}

	query<T extends HTMLElement>(selector: string): T | undefined {
		const root = this.element.renderRoot;

		return root.querySelector<T>(selector) ?? undefined;
	}

	queryAll<T extends HTMLElement>(selector: string): T[] {
		const root = this.element.renderRoot;
		if (!root)
			return [];

		return [ ...root.querySelectorAll<T>(selector) ];
	}
	//#endregion consumer-api


	//#region HTMLElement-interfaces
	get classList(): HTMLElement['classList'] {
		return this.element.classList;
	}

	get querySelector(): HTMLElement['querySelector'] {
		const element = this.element;

		return element.querySelector.bind(element);
	}

	get dispatchEvent(): HTMLElement['dispatchEvent'] {
		const element = this.element;

		return element.dispatchEvent.bind(element);
	}

	get addEventListener(): HTMLElement['addEventListener'] {
		return this.__addEventListener.bind(this);
	}

	get removeEventListener(): HTMLElement['removeEventListener'] {
		return this.__removeEventListener.bind(this);
	}

	protected __addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		this.element.addEventListener(type, listener, options);

		if (!this.__eventListeners)
			this.__eventListeners = new Map();

		const listeners = this.__eventListeners.get(type)
			?? this.__eventListeners.set(type, new Set()).get(type)!;

		listeners.add({ type, listener, options });
	}

	protected __removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void {
		this.element.removeEventListener(type, listener, options);

		const listeners = this.__eventListeners?.get(type);
		if (!listeners)
			return;

		for (const lst of listeners) {
			const { type: t, listener: l, options: o } = lst;
			if (t === type && l === listener && o === options)
				listeners.delete(lst);
		}
	}
	//#endregion HTMLElement-interfaces

}


const effectReaction = (ref: WeakRef<AdapterElement>) =>
	void ref.deref()?.requestUpdate();
