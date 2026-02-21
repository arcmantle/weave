import { SQLite } from './database.js';

/**
 * Checks if a table exists in the SQLite database.
 * Creates a temporary database connection to query the sqlite_master table.
 */
export const tableExists = (table: string): boolean => {
	using db = new SQLite();

	const result = db.prepare(/* sql */`
	SELECT name
	FROM sqlite_master
	WHERE type='table' AND name='${ table }';
	`).get();

	return !!result;
};
