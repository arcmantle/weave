// https://tc39.github.io/ecma262/#sec-typeof-operator
type Primitive = null | undefined | boolean | number | string | symbol | bigint;
export const isPrimitive = (value: unknown): value is Primitive =>
	value === null || (typeof value != 'object' && typeof value != 'function');


export const isIterable = (value: unknown): value is Iterable<unknown> =>
	Array.isArray(value) || typeof (value as any)?.[Symbol.iterator] === 'function';
