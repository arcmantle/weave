/* eslint-disable @stylistic/max-len */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

/**
 * Union type for class and member decorators.
 */
export type Decorator = ClassDecorator | MemberDecorator;

/**
 * Function type for decorating class members (properties, methods, accessors).
 */
export type MemberDecorator = <T>(target: Target, propertyKey: PropertyKey, descriptor?: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void;

/**
 * Valid types for metadata keys (string or symbol).
 */
export type MetadataKey = string | symbol;

/**
 * Valid types for property keys (string or symbol).
 */
export type PropertyKey = string | symbol;

/**
 * Valid target types for metadata operations (objects or functions).
 */
export type Target = object | Function;


const Metadata = new WeakMap();


/**
 * Applies decorators to a property in reverse order (right-to-left).
 */
const decorateProperty = (decorators: MemberDecorator[], target: Target, propertyKey: PropertyKey, descriptor?: PropertyDescriptor): PropertyDescriptor | undefined => {
	for (let i = decorators.length - 1; i >= 0; i--)
		descriptor = decorators[i]!(target, propertyKey, descriptor) || descriptor;

	return descriptor;
};


/**
 * Applies decorators to a constructor in reverse order (right-to-left).
 */
const decorateConstructor = (decorators: ClassDecorator[], target: Function): Function => {
	for (let i = decorators.length - 1; i >= 0; i--) {
		const decorated = decorators[i]!(target);
		if (decorated)
			target = decorated;
	}

	return target;
};


/**
 * Applies decorators to a target. Determines whether to decorate a class or property
 * based on the presence of propertyKey parameter.
 */
function decorate(decorators: ClassDecorator[], target: Function): Function;
function decorate(decorators: MemberDecorator[], target: object, propertyKey?: PropertyKey, attributes?: PropertyDescriptor): PropertyDescriptor | undefined;
function decorate(decorators: Decorator[], target: Target, propertyKey?: PropertyKey, attributes?: PropertyDescriptor): Function | PropertyDescriptor | undefined {
	if (propertyKey !== undefined)
		return decorateProperty(decorators as MemberDecorator[], target, propertyKey, attributes);
	if (typeof target === 'function')
		return decorateConstructor(decorators as ClassDecorator[], target);
}


/**
 * Retrieves the metadata map for a target object and optional property key.
 */
const getMetadataMap = <T>(target: Target, propertyKey?: PropertyKey): Map<MetadataKey, T> | undefined =>
	Metadata.get(target) && Metadata.get(target).get(propertyKey);


/**
 * Gets own metadata for a target without searching the prototype chain.
 */
const ordinaryGetOwnMetadata = <T>(key: MetadataKey, target: Target, propertyKey?: PropertyKey): T | undefined => {
	if (target === undefined)
		throw new TypeError();

	const metadataMap = getMetadataMap<T>(target, propertyKey);

	return metadataMap && metadataMap.get(key);
};


/**
 * Creates a new metadata map for a target and property key if one doesn't exist.
 */
const createMetadataMap = <T>(target: Target, propertyKey?: PropertyKey): Map<MetadataKey, T> => {
	const targetMetadata = Metadata.get(target) ?? new Map<PropertyKey | undefined, Map<MetadataKey, T>>();
	Metadata.set(target, targetMetadata);

	const metadataMap = targetMetadata.get(propertyKey) ?? new Map<MetadataKey, T>();
	targetMetadata.set(propertyKey, metadataMap);

	return metadataMap;
};


/**
 * Defines own metadata for a target without affecting the prototype chain.
 */
const ordinaryDefineOwnMetadata = <T>(key: MetadataKey, value: T, target: Target, propertyKey?: PropertyKey): void => {
	if (propertyKey && ![ 'string', 'symbol' ].includes(typeof propertyKey))
		throw new TypeError();

	const map = getMetadataMap<T>(target, propertyKey) ?? createMetadataMap<T>(target, propertyKey);
	map.set(key, value);
};


/**
 * Gets metadata for a target, searching up the prototype chain if not found on own properties.
 */
const ordinaryGetMetadata = <T>(key: MetadataKey, target: Target, propertyKey?: PropertyKey): T | undefined => {
	const ownMetadata = ordinaryGetOwnMetadata<T>(key, target, propertyKey);
	if (ownMetadata)
		return ownMetadata;

	const prototype = Object.getPrototypeOf(target);
	if (prototype)
		return ordinaryGetMetadata(key, prototype, propertyKey);
};


/**
 * Creates a decorator function that applies metadata to a target when used.
 */
const metadata = <T>(key: MetadataKey, value: T) =>
	(target: Target, propertyKey?: PropertyKey): void =>
		void ordinaryDefineOwnMetadata<T>(key, value, target, propertyKey);


/**
 * Retrieves metadata for a target, including inherited metadata from the prototype chain.
 */
const getMetadata = <T>(key: MetadataKey, target: Target, propertyKey?: PropertyKey): T | undefined =>
	ordinaryGetMetadata<T>(key, target, propertyKey);


/**
 * Retrieves own metadata for a target without searching the prototype chain.
 */
const getOwnMetadata = <T>(key: MetadataKey, target: Target, propertyKey?: PropertyKey): T | undefined =>
	ordinaryGetOwnMetadata<T>(key, target, propertyKey);


/**
 * Checks if own metadata exists for a target without searching the prototype chain.
 */
const hasOwnMetadata = (key: MetadataKey, target: Target, propertyKey?: PropertyKey): boolean =>
	!!ordinaryGetOwnMetadata(key, target, propertyKey);


/**
 * Checks if metadata exists for a target, including inherited metadata from the prototype chain.
 */
const hasMetadata = (key: MetadataKey, target: Target, propertyKey?: PropertyKey): boolean =>
	!!ordinaryGetMetadata(key, target, propertyKey);


/**
 * Defines metadata for a target object or property.
 */
const defineMetadata = <T>(key: MetadataKey, value: T, target: Target, propertyKey?: PropertyKey): void =>
	void ordinaryDefineOwnMetadata(key, value, target, propertyKey);


/**
 * Object containing all the reflect metadata API methods.
 */
export const ReflectMetadata: {
	decorate:       typeof decorate;
	metadata:       typeof metadata;
	getMetadata:    typeof getMetadata;
	getOwnMetadata: typeof getOwnMetadata;
	hasOwnMetadata: typeof hasOwnMetadata;
	defineMetadata: typeof defineMetadata;
	hasMetadata:    typeof hasMetadata;
} = {
	decorate,
	metadata,
	defineMetadata,
	getMetadata,
	getOwnMetadata,
	hasMetadata,
	hasOwnMetadata,
};


/**
 * Extends the global Reflect object with metadata APIs. Safe to call multiple times
 * as it won't override existing metadata implementations.
 */
export const useReflectMetadata = (): typeof Reflect & typeof ReflectMetadata => {
	const keys = Object.keys(ReflectMetadata);
	const existingProps = Object.getOwnPropertyNames(Reflect);
	if (existingProps.some(k => keys.includes(k)))
		return Reflect as any;

	return Object.assign(Reflect, ReflectMetadata);
};
