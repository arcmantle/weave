import type Database from 'better-sqlite3';

import type { Branded } from './brand.js';
import { SQLite } from './database.js';
import { exists } from './exists.js';
import { escapeString } from './sql.js';

/**
 * Main query builder class that provides a fluent interface for constructing and executing SQL queries.
 * Automatically manages database connections and provides methods for SELECT, INSERT, UPDATE, DELETE, and DDL operations.
 */
export class Query {

	#db: SQLite;

	/**
	 * Creates a new Query instance with a SQLite database connection.
	 * Automatically enables WAL mode for better concurrency.
	 */
	constructor(filename?: string) {
		this.#db = new SQLite(filename);
		this.#db.pragma('journal_mode = WAL');
	}

	/**
	 * Creates a SELECT query builder for the specified table.
	 */
	from<T extends object = object>(table: string): SelectBuilder<T> {
		return new SelectBuilder<T>(this.#db, table);
	}

	/**
	 * Creates an INSERT query builder for the specified table.
	 */
	insert<T extends object  = object>(table: string): InsertBuilder<T> {
		return new InsertBuilder<T>(this.#db, table);
	}

	/**
	 * Creates an UPDATE query builder for the specified table.
	 */
	update<T extends object = object>(table: string): UpdateBuilder<T> {
		return new UpdateBuilder<T>(this.#db, table);
	}

	/**
	 * Creates a DELETE query builder for the specified table.
	 */
	delete<T extends object = object>(table: string): DeleteBuilder<T> {
		return new DeleteBuilder<T>(this.#db, table);
	}

	/**
	 * Creates a table definition builder for creating or modifying table schemas.
	 */
	define<T extends object = object>(table: string): DefineBuilder<T> {
		return new DefineBuilder<T>(this.#db, table);
	}

	/**
	 * Executes multiple operations within a database transaction.
	 * All operations will be rolled back if any operation fails.
	 */
	transaction(transaction: (query: Query) => void): void {
		this.#db.transaction(() => void transaction(this));
	}

	/**
	 * Disposes of the database connection by closing it.
	 * This method is called automatically when using the 'using' keyword.
	 */
	[Symbol.dispose] = (): void => {
		this.#db.close();
	};

}


/**
 * Abstract base class for all query builders.
 * Provides common functionality for building and executing SQL queries.
 */
abstract class Builder {

	constructor(
		protected db: SQLite,
		protected table: string,
	) {}

	/**
	 * Returns the built SQL query as a string for debugging or logging purposes.
	 */
	get queryAsString(): string {
		return this.build();
	}

	/**
	 * Abstract method that must be implemented by subclasses to build the SQL query string.
	 */
	protected abstract build(): string;

	/**
	 * Abstract method that must be implemented by subclasses to execute the query.
	 */
	abstract query(): unknown;

}

/**
 * Builder for creating table definitions and schemas.
 * Supports creating tables with primary keys, columns with various types and constraints.
 */
class DefineBuilder<T extends object, Excluded extends keyof T = never> extends Builder {

	#override = false;
	#primaryKey = '';
	#columns = '';

	/**
	 * Enables override mode which will drop the existing table before creating a new one.
	 * WARNING! This will completely destroy all existing data in the table.
	 */
	override(): this {
		this.#override = true;

		return this;
	}

	/**
	 * Defines a primary key column for the table.
	 * The primary key is automatically set as INTEGER PRIMARY KEY.
	 */
	primaryKey<N extends Extract<keyof Omit<T, Excluded>, string | number>>(
		name: N,
	): Omit<DefineBuilder<T, Excluded | N>, 'primaryKey'> {
		this.#primaryKey = `${ name } INTEGER PRIMARY KEY`;

		return this as any;
	}

	/**
	 * Adds a column definition to the table.
	 * Supports INTEGER, TEXT, and REAL types with optional default values and null constraints.
	 */
	column<N extends Extract<keyof Omit<T, Excluded>, string | number>>(
		name: N,
		type: 'INTEGER' | 'TEXT' | 'REAL',
		options: {
			value?:    string | boolean;
			nullable?: boolean;
		} = {},
	): DefineBuilder<T, Excluded | N> {
		const { nullable } = options;
		let { value } = options;

		if (typeof value === 'string') {
			if (!/^\(.+?\)/.test(value))
				value = `'${ value }'`;
		}
		else if (typeof value === 'boolean') {
			value = String(value).toUpperCase();
		}

		if (this.#columns)
			this.#columns += ',';

		this.#columns += `${ name } ${ type }`
			+ ` ${ value !== undefined ? `DEFAULT ${ value }` : '' }`
			+ ` ${ !nullable ? 'NOT NULL' : '' }`;

		return this;
	}

	/**
	 * Builds the CREATE TABLE SQL statement.
	 * Includes DROP TABLE statement if override mode is enabled.
	 */
	protected override build(): string {
		return `
		${ this.#override ? `DROP TABLE ${ this.table }` : '' }
		CREATE TABLE IF NOT EXISTS ${ this.table } (
			${ this.#primaryKey ? this.#primaryKey + ',' : '' }
			${ this.#columns }
		)
		`;
	}

	/**
	 * Executes the table creation query and returns the result.
	 */
	override query(): Database.RunResult {
		return this.db.prepare(this.build()).run();
	}

}


/**
 * Builder for SELECT queries with support for filtering, ordering, grouping, and pagination.
 */
class SelectBuilder<T extends object = object> extends Builder {

	#select = '';
	#where = '';
	#groupBy = '';
	#orderBy = '';
	#limit?:  number;
	#offset?: number;

	/**
	 * Specifies which columns to select from the table.
	 * If not called, all columns (*) will be selected.
	 */
	select(...field: Extract<keyof T, string>[]): SelectBuilder<T> {
		field.forEach((name) => {
			if (this.#select)
				this.#select += ',';

			this.#select += name;
		});

		return this as SelectBuilder<T>;
	}

	/**
	 * Adds WHERE clause conditions using a filter function.
	 * The filter function provides methods for building SQL conditions.
	 */
	where(filter: (filter: Filter<T>) => FilterCondition): this {
		this.#where = filter(new Filter());

		return this;
	}

	/**
	 * Adds GROUP BY clause for aggregating results by specified columns.
	 */
	groupBy(...field: Extract<keyof T, string>[]): this {
		field.forEach(field => {
			if (this.#groupBy)
				this.#groupBy += ',';

			this.#groupBy += field;
		});

		return this;
	}

	/**
	 * Adds ORDER BY clause for sorting results.
	 * Supports ascending/descending order and NULLS LAST option.
	 */
	orderBy(
		field: Extract<keyof T, string>,
		order: 'asc' | 'desc' = 'asc',
		nullsLast?: true,
	): this {
		if (this.#orderBy)
			this.#orderBy += ',';

		this.#orderBy += `${ field } ${ order.toUpperCase() }`
			+ `${ nullsLast ? ' NULLS LAST' : '' }`;

		return this;
	}

	/**
	 * Limits the number of rows returned by the query.
	 */
	limit(limit: number): this {
		this.#limit = limit;

		return this;
	}

	/**
	 * Skips the specified number of rows before returning results.
	 */
	offset(offset: number): this {
		this.#offset = offset;

		return this;
	}

	/**
	 * Helper method to build the LIMIT and OFFSET clause.
	 */
	protected getLimitOffset(): string {
		const limitExists = exists(this.#limit);
		const offsetExists = exists(this.#offset);
		const bothExist = limitExists && offsetExists;
		const limitOnly = limitExists && !offsetExists;
		const offsetOnly = !limitExists && offsetExists;

		return bothExist   ? `LIMIT ${ this.#limit } OFFSET ${ this.#offset }`
			: limitOnly	    ? `LIMIT ${ this.#limit }`
				: offsetOnly ? `LIMIT -1 OFFSET ${ this.#offset }`
					: '';
	}

	/**
	 * Builds the complete SELECT SQL statement with all specified clauses.
	 */
	protected build(): string {
		return `
		SELECT ${ this.#select ? this.#select : '*' }
		FROM ${ this.table }
		${ this.#where ? `WHERE ${ this.#where }` : '' }
		${ this.#groupBy ? `GROUP BY ${ this.#groupBy }` : '' }
		${ this.#orderBy ? `ORDER BY ${ this.#orderBy }` : '' }
		${ this.getLimitOffset() }
		`;
	}

	/**
	 * Executes the SELECT query and returns all matching rows.
	 * Returns an empty array if the query fails or no rows are found.
	 */
	query(): T[] {
		try {
			return this.db.prepare(this.build()).all() as T[];
		}
		catch (error) {
			console.error(error);

			return [];
		}
	}

}


/**
 * Builder for UPDATE queries with support for conditional updates.
 * Note: ORDER BY, LIMIT, and OFFSET require special SQLite compilation flags.
 */
class UpdateBuilder<T extends object = object> extends Builder {

	#values = '';
	#where = '';
	#orderBy?: string;
	#limit?:   number;
	#offset?:  number;

	/**
	 * Sets the values to update for the specified fields.
	 * Automatically handles string escaping and skips undefined values.
	 */
	values(fields: Partial<T>): UpdateBuilder<T> {
		Object.entries(fields).forEach(([ name, value ]) => {
			if (value === undefined)
				return;

			if (this.#values)
				this.#values += ',';

			if (typeof value === 'string')
				value = `'${ escapeString(value) }'`;

			this.#values += `${ name } = ${ value }`;
		});

		return this as UpdateBuilder<T>;
	}

	/**
	 * Adds WHERE clause conditions to specify which rows to update.
	 */
	where(filter: (filter: Filter<T>) => FilterCondition): this {
		this.#where = filter(new Filter());

		return this;
	}

	/**
	 * Adds ORDER BY clause for the update operation.
	 * WARNING: This feature requires SQLite to be compiled with SQLITE_ENABLE_UPDATE_DELETE_LIMIT.
	 */
	orderBy(
		field: Extract<keyof T, string>,
		order: 'asc' | 'desc' = 'asc',
		nullsLast?: true,
	): this {
		throw new Error('Using this requires '
			+ 'https://www.sqlite.org/compile.html#enable_update_delete_limit');

		if (this.#orderBy)
			this.#orderBy += ',';

		this.#orderBy += `${ field } ${ order.toUpperCase() }`
			+ `${ nullsLast ? ' NULLS LAST' : '' }`;

		return this;
	}

	/**
	 * Limits the number of rows to update.
	 * WARNING: This feature requires SQLite to be compiled with SQLITE_ENABLE_UPDATE_DELETE_LIMIT.
	 */
	limit(limit: number): this {
		throw new Error('Using this requires '
			+ 'https://www.sqlite.org/compile.html#enable_update_delete_limit');

		this.#limit = limit;

		return this;
	}

	/**
	 * Specifies an offset for the update operation.
	 * WARNING: This feature requires SQLite to be compiled with SQLITE_ENABLE_UPDATE_DELETE_LIMIT.
	 */
	offset(offset: number): this {
		throw new Error('Using this requires '
			+ 'https://www.sqlite.org/compile.html#enable_update_delete_limit');

		this.#offset = offset;

		return this;
	}

	/**
	 * Helper method to build the LIMIT and OFFSET clause for UPDATE statements.
	 */
	protected getLimitOffset(): string {
		const limitExists = exists(this.#limit);
		const offsetExists = exists(this.#offset);
		const bothExist = limitExists && offsetExists;
		const limitOnly = limitExists && !offsetExists;
		const offsetOnly = !limitExists && offsetExists;

		return bothExist   ? `LIMIT ${ this.#limit } OFFSET ${ this.#offset }`
			: limitOnly	    ? `LIMIT ${ this.#limit }`
				: offsetOnly ? `LIMIT -1 OFFSET ${ this.#offset }`
					: '';
	}

	/**
	 * Builds the complete UPDATE SQL statement.
	 */
	protected build(): string {
		return `
		UPDATE ${ this.table }
		SET ${ this.#values }
		${ this.#where ? `WHERE ${ this.#where }` : '' }
		${ this.#orderBy ? `ORDER ${ this.#orderBy }` : '' }
		${ this.getLimitOffset() }
		`;
	}

	/**
	 * Executes the UPDATE query and returns information about the operation.
	 * Returns undefined if the query fails.
	 */
	query(): Database.RunResult | undefined {
		try {
			return this.db.prepare(this.build()).run();
		}
		catch (error) {
			console.error(error);
		}
	}

}


/**
 * Builder for INSERT queries that supports inserting single rows.
 */
class InsertBuilder<T extends object = object> extends Builder {

	#columns = '';
	#values = '';

	/**
	 * Sets the values to insert for the new row.
	 * Automatically handles string escaping and skips undefined values.
	 * If no values are provided, generates an INSERT with DEFAULT VALUES.
	 */
	values(fields: T): this {
		Object.entries(fields).forEach(([ name, value ]) => {
			if (value === undefined)
				return;

			if (typeof value === 'string')
				value = `'${ escapeString(value) }'`;

			this.#values += (this.#values ? ',' : '') + value;
			this.#columns += (this.#columns ? ',' : '') + name;
		});

		return this;
	}

	/**
	 * Builds the INSERT SQL statement.
	 * Uses DEFAULT VALUES syntax if no columns and values are specified.
	 */
	protected build(): string {
		if (!this.#columns && !this.#values)
			return `INSERT INTO ${ this.table } DEFAULT VALUES`;

		return `
		INSERT INTO ${ this.table } (${ this.#columns })
		VALUES (${ this.#values })
		`;
	}

	/**
	 * Executes the INSERT query and returns information about the operation.
	 * Returns undefined if the query fails.
	 */
	query(): Database.RunResult | undefined {
		try {
			return this.db.prepare(this.build()).run();
		}
		catch (error) {
			console.error(error);
		}
	}

}


/**
 * Builder for DELETE queries with support for conditional deletion.
 */
class DeleteBuilder<T extends object = object> extends Builder {

	#where = '';

	/**
	 * Adds WHERE clause conditions to specify which rows to delete.
	 * Without a WHERE clause, all rows in the table will be deleted.
	 */
	where(filter: (filter: Filter<T>) => FilterCondition): this {
		this.#where = filter(new Filter());

		return this;
	}

	/**
	 * Builds the DELETE SQL statement.
	 */
	protected build(): string {
		return `
		DELETE FROM ${ this.table }
		${ this.#where ? `WHERE ${ this.#where }` : '' }
		`;
	}

	/**
	 * Executes the DELETE query and returns information about the operation.
	 * Returns undefined if the query fails.
	 */
	query(): Database.RunResult | undefined {
		try {
			return this.db.prepare(this.build()).run();
		}
		catch (error) {
			console.error(error);
		}
	}

}


type FilterCondition = Branded<string, 'FilterCondition'>;

/**
 * Filter builder class that provides methods for creating SQL WHERE clause conditions.
 * All methods return branded FilterCondition strings that can be combined with logical operators.
 */
export class Filter<T = Record<string, string | number>> {

	/**
	 * Combines multiple filter conditions with AND logic.
	 */
	and(...conditions: FilterCondition[]): FilterCondition {
		return `${ conditions.join(' AND ') }` as FilterCondition;
	}

	/**
	 * Combines multiple filter conditions with OR logic.
	 * Automatically wraps the result in parentheses.
	 */
	or(...conditions: FilterCondition[]): FilterCondition {
		return `(${ conditions.join(' OR ') })` as FilterCondition;
	}

	/**
	 * Creates an equality condition for exact value matching.
	 */
	eq<K extends Extract<keyof T, string>>(field: K, value: T[K]): FilterCondition {
		return `${ field } = '${ value }'` as FilterCondition;
	}

	/**
	 * Creates a LIKE condition for matching strings that start with the given value.
	 * Automatically handles SQL wildcard character escaping.
	 */
	startsWith(field: Extract<keyof T, string>, value: string): FilterCondition {
		const mustEscape = this.mustEscape(value);
		if (mustEscape)
			value = this.escape(value);

		return this.finalize(`${ field } LIKE '${ value }%'`, mustEscape);
	}

	/**
	 * Creates a LIKE condition for matching strings that end with the given value.
	 * Automatically handles SQL wildcard character escaping.
	 */
	endsWith(field: Extract<keyof T, string>, value: string): FilterCondition {
		const mustEscape = this.mustEscape(value);
		if (mustEscape)
			value = this.escape(value);

		return this.finalize(`${ field } LIKE '%${ value }'`, mustEscape);
	}

	/**
	 * Creates a LIKE condition for matching strings that contain the given value.
	 * Automatically handles SQL wildcard character escaping.
	 */
	contains(field: Extract<keyof T, string>, value: string): FilterCondition {
		const mustEscape = this.mustEscape(value);
		if (mustEscape)
			value = this.escape(value);

		return this.finalize(`${ field } LIKE '%${ value }%'`, mustEscape);
	}

	/**
	 * Creates an IN condition for matching any of the provided values.
	 * Automatically handles string quoting for string values.
	 */
	oneOf<K extends Extract<keyof T, string>>(field: K, ...values: T[K][]): FilterCondition {
		const escapedValues = values.map(v => {
			return typeof v === 'string'
				? `'${ v }'`
				: v;
		}).join(',');

		return `${ field } IN (${ escapedValues })` as FilterCondition;
	}

	/**
	 * Creates a NOT IN condition for excluding any of the provided values.
	 */
	notOneOf<K extends Extract<keyof T, string>>(field: K, ...values: T[K][]): FilterCondition {
		return `${ field } NOT IN (${ values.join(',') })` as FilterCondition;
	}

	/**
	 * Creates an IS NOT NULL condition to check if a field has a value.
	 */
	exists(field: Extract<keyof T, string>): FilterCondition {
		return `${ field } IS NOT NULL` as FilterCondition;
	}

	/**
	 * Creates an IS NULL condition to check if a field is null.
	 */
	notExists(field: Extract<keyof T, string>): FilterCondition {
		return `${ field } IS NULL` as FilterCondition;
	}

	/**
	 * Creates a GLOB condition for pattern matching using Unix shell-style wildcards.
	 */
	glob(field: Extract<keyof T, string>, value: string): FilterCondition {
		return `${ field } GLOB '${ value }'` as FilterCondition;
	}

	/**
	 * Checks if a string value contains SQL wildcard characters that need escaping.
	 */
	protected mustEscape(value: string): boolean {
		const mustEscape = value.includes('%') || value.includes('_');

		return mustEscape;
	}

	/**
	 * Escapes SQL wildcard characters in a string value.
	 */
	protected escape(value: string): string {
		return value = value.replaceAll(/%/g, '\\%')
			.replaceAll(/_/g, '\\_');
	}

	/**
	 * Finalizes a LIKE condition by adding ESCAPE clause if needed.
	 */
	protected finalize(value: string, escape: boolean): FilterCondition {
		return value + (escape ? ` ESCAPE '\\'` : '') as FilterCondition;
	}

}
