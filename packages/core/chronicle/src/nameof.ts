import { normalizePropertyKey } from './symbol-id.ts';


// nameof property path is stored here for retrieval.
const propertyThatWasAccessed: string[] = [];


// Proxy objects to store the property path.
const proxy: any = new Proxy({} as any, {
	get: <const C extends PropertyKey>(_: any, prop: C) => {
		// Normalize to stable id so bracket keys with dots and Symbols become stable segments
		propertyThatWasAccessed.push(normalizePropertyKey(prop));

		return proxy;
	},
});


export type Nameof<T> = (m: T extends object ? T : any) => any;


/**
 * Returns either the last part of a objects path  \
 * or dotted path if the fullPath flag is set to true.
 */
export const nameof = <const T>(expression: (instance: T) => any): string => {
	propertyThatWasAccessed.length = 0;
	expression(proxy);

	return propertyThatWasAccessed.join('.');
};

/**
 * Returns a fresh array of path segments captured from the selector expression.
 * The returned array is a new copy to avoid external mutations affecting internals.
 */
export const nameofSegments = <const T>(expression: (instance: T) => any): string[] => {
	propertyThatWasAccessed.length = 0;
	expression(proxy);

	return propertyThatWasAccessed.slice();
};
