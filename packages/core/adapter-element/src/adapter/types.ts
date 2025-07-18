import type { PluginContainer } from '@arcmantle/injector';

import type { AdapterElement } from './adapter-element.ts';


export type PropertyType =
	| StringConstructor
	| ObjectConstructor
	| NumberConstructor
	| BooleanConstructor;

export interface AdapterMetadata {
	styles?:            CSSStyleSheet[];
	pluginContainer?:   PluginContainer;
	observedAttributes: string[];
	signalProps:        string[];
	changedProps:       Map<keyof any, any>;
	previousProps:      Map<keyof any, any>;
	propertyMetadata:   Record<string, {
		propName:      string;
		type:          PropertyType;
		reflect:       boolean;
		initialValue?: any;
	}>;
}


export type HTMLAdapterElement<T extends AdapterElement> = HTMLElement & { adapter: T; };
