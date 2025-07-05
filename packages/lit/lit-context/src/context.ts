import type { LitElement, ReactiveController } from 'lit';
import { state } from 'lit/decorators.js';


export interface ContextProp<T = any> { value: T; }
export type ConsumeContextEvent<T = any> = CustomEvent<{ prop: { value: T; }; }>;

type RecordOf<
	T extends object = object,
	TK extends keyof any = keyof any,
	TV = any,
> = T & Record<TK, TV>;
type PropName = string;


export const createEventName = (prop: string | symbol): string =>
	'consume-context:' + prop.toString();

export const createHydrateName = (prop: string | symbol): string =>
	'hydrate-context:' + prop.toString();


class ProviderController implements ReactiveController {

	static providerSym = Symbol.for('providerCtrl');
	protected static cache: WeakMap<LitElement, `${ string }<:>${ string }`[]> = new WeakMap();

	static register(host: RecordOf<LitElement>, name: string, prop: string) {
		if (!host[this.providerSym]) {
			host[this.providerSym] = true;

			// Using this as a way to get the end of prototype chain.
			const original = host.connectedCallback;
			host.connectedCallback = function() {
				this.addController(new ProviderController(this));
				original.call(this);
			};
		}

		const cache = this.cache.get(host) ??
			this.cache.set(host, []).get(host)!;

		cache.push(`${ name }<:>${ prop }`);
	}

	constructor(protected host: RecordOf<LitElement>) {}

	protected updatedProps: Set<PropName> = new Set();
	protected cache: Map<PropName, {
		eventName:   string;
		hydrateName: string;
		provider:    (ev: Event) => any;
	}> = new Map();

	hostConnected(): void {
		const protoChain: any[] = [];
		let current = this.host;

		while (current) {
			protoChain.push(current);
			current = Object.getPrototypeOf(current);
		}

		const providers = protoChain
			.flatMap(proto => ProviderController.cache.get(proto))
			.reduce((acc, value) => {
				if (value)
					acc.add(value);

				return acc;
			}, new Set<string>());

		for (const value of providers)
			this.add(...value.split('<:>') as [string, string]);
	}

	hostDisconnected(): void {
		for (const value of this.cache.values())
			this.host.removeEventListener(value.eventName, value.provider);

		this.cache.clear();
	}

	hostUpdate(): void {
		this.cache.forEach(({ hydrateName }, prop) => {
			if (!this.updatedProps.has(prop))
				return;

			const ev = new CustomEvent(hydrateName, { cancelable: false });
			globalThis.dispatchEvent(ev);
		});
	}

	add(name: string, prop: string) {
		const me = this as unknown as this;
		const getHost = () => this.host;

		const hydrateName = createHydrateName(name);
		const eventName = createEventName(name);

		const provider = (ev: Event) => {
			ev.preventDefault();
			ev.stopPropagation();
			ev.stopImmediatePropagation();

			const event = ev as ConsumeContextEvent;
			event.detail.prop = {
				get value() {
					return getHost()[prop];
				},
				set value(value: any) {
					const host = getHost();
					if (host[prop] !== value)
						me.updatedProps.add(prop);

					host[prop] = value;
				},
			};
		};

		this.cache.set(prop, { eventName, hydrateName, provider });
		this.host.addEventListener(eventName, provider);
	}

}


class ConsumerController implements ReactiveController {

	protected static consumerSym = Symbol.for('consumerCtrl');
	protected static cache: WeakMap<LitElement, `${ string }<:>${ string }`[]> = new WeakMap();

	static register(host: RecordOf<LitElement>, name: string, prop: string) {
		if (!host[this.consumerSym]) {
			host[this.consumerSym] = true;

			// Using this as a way to get the end of prototype chain.
			const original = host.connectedCallback;
			host.connectedCallback = function() {
				this.addController(new ConsumerController(this));
				original.call(this);
			};
		}

		const cache = this.cache.get(host) ??
			this.cache.set(host, []).get(host)!;

		cache.push(`${ name }<:>${ prop }`);
	}

	constructor(protected host: RecordOf<LitElement>) {}

	protected cache: Map<PropName, {
		eventName:   string;
		hydrateName: string;
		consumer:    () => any;
	}> = new Map();

	hostConnected(): void {
		const protoChain: any[] = [];
		let current = this.host;
		while (current) {
			protoChain.push(current);
			current = Object.getPrototypeOf(current);
		}

		const consumers = protoChain
			.flatMap(proto => ConsumerController.cache.get(proto))
			.reduce((acc, value) => {
				if (value)
					acc.add(value);

				return acc;
			}, new Set<string>());

		consumers.forEach((value) =>
			this.add(...value.split('<:>') as [string, string]));
	}

	hostDisconnected(): void {
		this.cache.forEach(value =>
			globalThis.removeEventListener(value.hydrateName, value.consumer));

		this.cache.clear();
	}

	add(name: string, prop: string) {
		const hydrateName = createHydrateName(name);
		const eventName = createEventName(name);

		const consumer = () => {
			const event = new CustomEvent(eventName, {
				bubbles:    true,
				composed:   true,
				cancelable: false,
				detail:     { prop: undefined },
			});
			this.host.dispatchEvent(event);

			const property = event.detail.prop;
			if (property !== undefined)
				this.host[prop] = property;
			else
				console.error('Could not consume ' + name);
		};

		this.cache.set(prop, { eventName, hydrateName, consumer });

		consumer();
		globalThis.addEventListener(hydrateName, consumer);
	}

}


export const provide = (name?: string) => (target: RecordOf<LitElement>, prop: string): any => {
	ProviderController.register(target, name ?? prop, prop);

	return state()(target, prop);
};


export const consume = (name?: string) => (target: RecordOf<LitElement>, prop: string): any => {
	ConsumerController.register(target, name ?? prop, prop);

	return state()(target, prop);
};
