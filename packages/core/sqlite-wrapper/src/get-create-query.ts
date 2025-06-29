import type SQLite from 'better-sqlite3';

import { sql } from './sql.ts';

/**
 * Retrieves the CREATE TABLE statement for a given table from the database.
 * Queries the sqlite_master table to get the original SQL used to create the table.
 */
export const getCreateQuery = (db: SQLite.Database, table: string): string => {
	return (db.prepare(sql`
	SELECT sql FROM sqlite_master
	WHERE tbl_name = '${ table }' AND type = 'table'
	`).get() as { sql: string; }).sql;
};

/**
 * Gets detailed information about all columns in a table.
 * Uses the PRAGMA table_info command to retrieve column metadata including
 * column ID, name, type, null constraints, default values, and primary key status.
 */
export const getTableColumns = (db: SQLite.Database, table: string): {
	cid:        number;
	name:       string;
	type:       string;
	notnull:    0 | 1;
	dflt_value: null | string | number;
	pk:         0 | 1;
}[] => db.prepare(sql`PRAGMA table_info(${ table });`).all() as any;
