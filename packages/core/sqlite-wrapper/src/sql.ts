/**
 * Template literal function for creating raw SQL strings.
 * Allows for safe construction of SQL queries using template literals.
 */
export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string =>
	String.raw({ raw: strings }, ...values);

/**
 * Escapes single quotes in a string for safe use in SQL queries.
 * Replaces single quotes with double single quotes as per SQL standard.
 */
export const escapeString = (str: string): string => {
	return str.replaceAll("'", "''");
};
