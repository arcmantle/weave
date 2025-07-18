const kValidateObjectNone = 0;
const kValidateObjectAllowNullable = 1 << 0;
const kValidateObjectAllowArray = 1 << 1;
const kValidateObjectAllowFunction = 1 << 2;


/**
 * Validates that the value is an object.
 * Throws an error if the value is not an object, or if it is null or an array,
 * depending on the options provided.
 */
export const validateObject = <T>(
	value: T,
	name: string,
	options: number = kValidateObjectNone,
): value is T => {
	if (options === kValidateObjectNone) {
		if (value === null || Array.isArray(value))
			throw new Error(`${ name } Object ${ value }`);

		if (typeof value !== 'object')
			throw new Error(`${ name } Object ${ value }`);
	}
	else {
		const throwOnNullable = (kValidateObjectAllowNullable & options) === 0;

		if (throwOnNullable && value === null)
			throw new Error(`${ name } Object ${ value }`);

		const throwOnArray = (kValidateObjectAllowArray & options) === 0;

		if (throwOnArray && Array.isArray(value))
			throw new Error(`${ name } Object ${ value }`);

		const throwOnFunction = (kValidateObjectAllowFunction & options) === 0;
		const typeofValue = typeof value;

		if (typeofValue !== 'object' && (throwOnFunction || typeofValue !== 'function'))
			throw new Error(`${ name } Object ${ value }`);
	}

	return true;
};


/**
 * Validates that the value is a string.
 * Returns true if the value is a string, false otherwise.
 */
export const validateString = (value: any, _name: string): value is string => {
	if (typeof value !== 'string')
		return false;

	return true;
};
