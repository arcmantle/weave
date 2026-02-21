import Original from 'better-sqlite3';

/**
 * Extended SQLite database class that wraps better-sqlite3 with additional configuration.
 * Automatically enables WAL mode and provides disposable resource management.
 */
export class SQLite extends Original {

	/**
	 * Creates a new SQLite database instance with WAL mode enabled.
	 * WAL (Write-Ahead Logging) mode allows for better concurrency.
	 */
	constructor(filename?: string, options?: Original.Options) {
		super(filename, options);
		this.pragma('journal_mode = WAL');
	}

	/**
	 * Disposes of the database connection by closing it.
	 * This method is called automatically when using the 'using' keyword.
	 */
	[Symbol.dispose](): void {
		this.close();
	}

}
