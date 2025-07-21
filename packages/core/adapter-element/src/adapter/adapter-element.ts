import { PluginContainer, PluginModule } from '@arcmantle/injector';
import { traverseDomUp } from '@arcmantle/library/dom';
import type { Writeable } from '@arcmantle/library/types';
import { effect } from '@preact/signals-core';
import { render, type RenderOptions, type RootPart } from 'lit-html';

import { type CSSStyle, getInheritanceFlatStyles } from '../shared/css.ts';
import type { ReactiveController, ReactiveControllerHost } from '../shared/reactive-controller.ts';
import type { AdapterMetadata } from './types.ts';


// Ensure metadata is enabled. TypeScript does not polyfill
// Symbol.metadata, so we must ensure that it exists.
(Symbol as { metadata: symbol; }).metadata ??= Symbol('metadata');


export class AdapterBase extends HTMLElement {

	declare ['constructor']: typeof AdapterBase;

	protected static adapter: typeof AdapterElement;
	static shadowRootOptions: ShadowRootInit = { mode: 'open' };

	constructor() {
		super();

		const base = this.constructor as any as typeof AdapterBase;
		const metadata = base.adapter.metadata;

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

	readonly renderRoot: DocumentFragment | HTMLElement;
	readonly adapter:    AdapterElement;

	protected __attrCtrl: MutationObserver | undefined;
	adapterInitialized:   boolean = false;
	pluginContainer:      PluginContainer;

	createRenderRoot(): HTMLElement | DocumentFragment {
		const renderRoot = this.shadowRoot
			?? this.attachShadow(this.constructor.shadowRootOptions);

		(this as Writeable<this>).renderRoot = this.shadowRoot!;

		const base = this.constructor as any as typeof AdapterBase;
		const metadata = base.adapter.metadata;

		metadata.styles = getInheritanceFlatStyles('styles', base.adapter);
		renderRoot.adoptedStyleSheets = metadata.styles;

		return renderRoot;
	}

	protected connectedCallback(): void {
		// Can be used to identify a wc from a regular HTMLElement.
		this.setAttribute('data-wc', '');
		(this as Writeable<typeof this>).renderRoot ??= this.createRenderRoot();

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

			(this as Writeable<this>).adapter = new base.adapter(new WeakRef(this));

			this.adapterInitialized = true;

			// Set the props that were assigned before the adapter was initialized.
			// This is done after the initialized flag as the setter has a check to only
			// set the value if the adapter is initialized.
			for (const prop of Object.values(metadata.propertyMetadata))
				(this as Record<keyof any, any>)[prop.propName] = prop.initialValue;

			// Set the initial values of the attribute properties.
			metadata.observedAttributes?.forEach(attr => {
				if (!this.hasAttribute(attr))
					return;

				const value = this.getAttribute(attr) ?? '';
				this.attributeChanged(attr, value);
			});
		}

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
	constructor(element: WeakRef<AdapterBase>) {
		this.__element = element;
	}

	static readonly tagName: string;
	static readonly styles:  CSSStyle;


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

	private __element:         WeakRef<AdapterBase>;
	private __unsubEffect?:    () => void;
	private __controllers:     Set<ReactiveController> = new Set();
	private __updatePromise:   Promise<boolean> = Promise.resolve(true);
	private __eventListeners?: Map<string, Set<{
		type:     string;
		listener: EventListenerOrEventListenerObject;
		options?: boolean | AddEventListenerOptions;
	}>>;

	protected readonly renderOptions: RenderOptions = { host: this };

	hasConnected = false;
	hasUpdated = false;
	isUpdatePending = false;
	childPart: RootPart | undefined = undefined;

	get updateComplete(): Promise<boolean> {
		return this.getUpdateComplete();
	}

	protected getUpdateComplete(): Promise<boolean> {
		return this.__updatePromise;
	}

	get element(): AdapterBase {
		const element = this.__element.deref();
		if (!element)
			throw new Error('Element reference has been lost...');

		return element;
	}

	//#region component-lifecycle
	/** Called first time this instance of the element is connected to the DOM. */
	firstConnected(): void {
		this.hasConnected = true;
	}

	/** Called every time this instance of the element is connected to the DOM. */
	connected(): void {
		this.requestUpdate();

		for (const controller of this.__controllers)
			controller.hostConnected?.();

		this.childPart?.setConnected(true);

		this.updateComplete.then(() => {
			setTimeout(() => this.afterConnected());
		});
	}

	/** Called after a setTimeout of 0 after the render method. */
	afterConnected(): void {}

	disconnected(): void {
		this.childPart?.setConnected(false);

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

	protected beforeUpdate(changedProps: Map<PropertyKey, unknown>): void {}

	protected update(changedProps: Map<PropertyKey, unknown>): void {
		const value = this.render();

		if (!this.hasUpdated)
			this.renderOptions.isConnected = this.element.isConnected;

		this.__markUpdated();

		this.childPart = render(value, this.element.renderRoot, this.renderOptions);
	}

	protected render(): unknown {
		return;
	};

	protected afterUpdate(changedProps: Map<PropertyKey, unknown>): void {}

	protected afterFirstUpdate(changedProps: Map<PropertyKey, unknown>): void {}
	//#endregion component-lifecycle


	addController(controller: ReactiveController): void {
		this.__controllers.add(controller);

		if (this.element.renderRoot !== undefined && this.element.isConnected)
			controller.hostConnected?.();
	}

	removeController(controller: ReactiveController): void {
		this.__controllers.delete(controller);
	}

	requestUpdate(): void {
		if (this.isUpdatePending)
			return;

		this.__updatePromise = this.enqueueUpdate();
	}

	protected async enqueueUpdate(): Promise<boolean> {
		this.isUpdatePending = true;

		try {
			// Ensure any previous update has resolved before updating.
			// This `await` also ensures that property changes are batched.
			await this.__updatePromise;
		}
		catch (e) {
			// Refire any previous errors async so they do not disrupt the update
			// cycle. Errors are refired so developers have a chance to observe
			// them, and this can be done by implementing
			// `window.onunhandledrejection`.
			Promise.reject(e);
		}
		const result = this.scheduleUpdate();
		if (result?.then)
			await result;

		return !this.isUpdatePending;
	}

	protected scheduleUpdate(): void | Promise<unknown> {
		const result = this.performUpdate();

		return result;
	}

	performUpdate(): void {
		// Abort any update if one is not pending when this is called.
		// This can happen if `performUpdate` is called early to "flush" the update.
		if (!this.isUpdatePending)
			return;

		this.__unsubEffect?.();
		const selfRef = new WeakRef(this);

		this.__unsubEffect = effect(this.__createUpdateEffect(selfRef));
	}

	protected shouldUpdate(changedProperties: Map<PropertyKey, unknown>): boolean {
		return true;
	}

	protected __didUpdate(changedProperties: Map<PropertyKey, unknown>): void {
		this.__controllers?.forEach((c) => c.hostUpdated?.());

		if (!this.hasUpdated) {
			this.hasUpdated = true;

			this.afterFirstUpdate(changedProperties);
		}

		this.afterUpdate(changedProperties);
	}

	protected __markUpdated(): void {
		const base = this.constructor;
		const metadata = base.metadata;

		metadata.changedProps = new Map();

		this.isUpdatePending = false;
	}

	// *Important* do not use "this" in the effect function.
	// This is avoid potential memory leaks by ensuring that the effect
	// does not hold a reference to the element.
	// Instead, use a WeakRef to the element.
	// This allows the effect to be garbage collected when the element is removed.
	protected __createUpdateEffect(ref: WeakRef<AdapterElement>, nativeUpdate: boolean = true) {
		return (): void => {
			const self = ref.deref();
			if (!self)
				return console.warn('Element reference lost during update.');

			if (!nativeUpdate)
				return self.requestUpdate();

			nativeUpdate = false;

			const base = self.constructor;
			const metadata = base.metadata;

			if (!self.hasUpdated) {
				// Create renderRoot before first update. This occurs in `connectedCallback`
				// but is done here to support out of tree calls to `enableUpdating`/`performUpdate`.
				const element = self.element as Writeable<typeof self.element>;
				element.renderRoot ??= element.createRenderRoot();
			}

			for (const prop of metadata.signalProps) {
				const value = self[prop as keyof typeof self];
				const previous = !self.hasUpdated
					? undefined
					: metadata.previousProps.get(prop);

				if (!metadata.changedProps.has(prop) && previous !== value) {
					metadata.changedProps.set(prop, previous);
					metadata.previousProps.set(prop, value);
				}
			}

			let shouldUpdate = false;
			try {
				shouldUpdate = self.shouldUpdate(metadata.changedProps);
				if (shouldUpdate) {
					self.beforeUpdate(metadata.changedProps);
					self.__controllers?.forEach((c) => c.hostUpdate?.());
					self.update(metadata.changedProps);
				}
				else {
					this.__markUpdated();
				}
			}
			catch (e) {
				// Prevent `firstUpdated` and `updated` from running when there's an update exception.
				shouldUpdate = false;

				// Ensure element can accept additional updates after an exception.
				self.__markUpdated();

				throw e;
			}

			// The update is no longer considered pending and further updates are now allowed.
			if (shouldUpdate)
				self.__didUpdate(metadata.changedProps);
		};
	};


	//#region consumer-api
	/** Retrieves a bound value from the dependency injection container. */
	get inject(): PluginContainer {
		const element = this.element;

		return element.pluginContainer;
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
