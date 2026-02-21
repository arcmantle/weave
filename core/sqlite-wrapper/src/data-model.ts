/**
 * Base class for data models that provides automatic property assignment from value objects.
 * Includes optional static methods for parsing and initialization.
 */
export class DataModel {

	/**
	 * Creates a new data model instance and assigns all properties from the values object.
	 */
	protected constructor(values: any) {
		for (const [ key, value ] of Object.entries(values))
			(this as any)[key] = value;
	}

	/**
	 * Optional static method for parsing unknown values into a known format.
	 * Should be implemented by subclasses if needed.
	 */
	static parse?(values: unknown): unknown;

	/**
	 * Optional static method for initializing values before creating an instance.
	 * Should be implemented by subclasses if needed.
	 */
	static initialize?(values: unknown): unknown;

}
