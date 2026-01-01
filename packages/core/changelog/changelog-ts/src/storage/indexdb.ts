import type { ChangeGroup, ChangeRecord, QueryOptions } from '../types.js';
import type { ChangelogStorage } from './interface.js';

/**
 * IndexedDB-based storage implementation for changelog
 * Provides persistent storage in the browser
 */
export class IndexedDBStorage<T = any> implements ChangelogStorage<T> {

	private dbName: string;
	private db:     IDBDatabase | null = null;

	constructor(dbName: string = 'changelog-db') {
		if (!dbName || typeof dbName !== 'string')
			throw new Error('dbName must be a non-empty string');

		this.dbName = dbName;
	}

	/**
	 * Initialize the database connection
	 */
	private async ensureDB(): Promise<IDBDatabase> {
		if (this.db)
			return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onerror = () => {
				const error = request.error;
				reject(new Error(`Failed to open IndexedDB database '${ this.dbName }': ${ error?.message ?? 'Unknown error' }`));
			};

			request.onblocked = () => {
				reject(
					new Error(
						'IndexedDB database upgrade blocked. ' +
						'Close other tabs/windows using this database.',
					),
				);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create object stores
				if (!db.objectStoreNames.contains('states'))
					db.createObjectStore('states', { keyPath: 'documentId' });

				if (!db.objectStoreNames.contains('changes')) {
					const changeStore = db.createObjectStore('changes', {
						keyPath:       'id',
						autoIncrement: true,
					});
					changeStore.createIndex('documentId', 'documentId', {
						unique: false,
					});
					changeStore.createIndex('timestamp', 'timestamp', {
						unique: false,
					});
				}
				if (!db.objectStoreNames.contains('groups')) {
					const groupStore = db.createObjectStore('groups', {
						keyPath: 'id',
					});
					groupStore.createIndex('documentId', 'documentId', {
						unique: false,
					});
				}
				if (!db.objectStoreNames.contains('counters'))
					db.createObjectStore('counters', { keyPath: 'documentId' });
			};
		});
	}

	async loadState(documentId: string): Promise<T | null> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'states' ], 'readonly');
			const store = tx.objectStore('states');
			const request = store.get(documentId);

			request.onsuccess = () => {
				const result = request.result;
				resolve(result ? result.state : null);
			};
			request.onerror = () => {
				const error = request.error;
				reject(new Error(`Failed to load state for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	async saveState(documentId: string, state: T): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'states' ], 'readwrite');
			const store = tx.objectStore('states');
			const request = store.put({ documentId, state });

			request.onsuccess = () => resolve();
			request.onerror = () => {
				const error = request.error;
				reject(new Error(`Failed to save state for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	async appendChanges(
		documentId: string,
		changes: ChangeRecord[],
		groupId: string,
	): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'changes' ], 'readwrite');
			const store = tx.objectStore('changes');

			for (const change of changes)
				store.add({ ...change, documentId });


			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async getChanges(
		documentId: string,
		options?: QueryOptions,
	): Promise<ChangeRecord[]> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'changes' ], 'readonly');
			const store = tx.objectStore('changes');
			const index = store.index('documentId');
			const request = index.getAll(documentId);

			request.onsuccess = () => {
				let records: ChangeRecord[] = request.result;

				// Apply filters
				if (options?.since !== undefined)
					records = records.filter((r) => r.timestamp >= options.since!);

				if (options?.groupId !== undefined)
					records = records.filter((r) => r.groupId === options.groupId);

				if (options?.limit !== undefined)
					records = records.slice(0, options.limit);

				resolve(records);
			};
			request.onerror = () => {
				const error = request.error;
				reject(new Error(`Failed to get changes for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	async createGroup(
		documentId: string,
		metadata?: Record<string, any>,
	): Promise<string> {
		const db = await this.ensureDB();

		// Get and increment counter
		const counter = await new Promise<number>((resolve, reject) => {
			const tx = db.transaction([ 'counters' ], 'readwrite');
			const store = tx.objectStore('counters');
			const request = store.get(documentId);

			request.onsuccess = () => {
				const current = request.result?.counter ?? 0;
				const next = current + 1;
				store.put({ documentId, counter: next });
				resolve(next);
			};
			request.onerror = () => {
				const error = request.error;
				reject(new Error(
					`Failed to increment counter for document '${ documentId }': `
					+ `${ error?.message ?? 'Unknown error' }`,
				));
			};
		});

		const groupId = `g${ counter }`;

		// Create the group
		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'groups' ], 'readwrite');
			const store = tx.objectStore('groups');

			const group: ChangeGroup & { documentId: string; } = {
				id:          groupId,
				documentId,
				timestamp:   Date.now(),
				changeCount: 0,
				metadata,
			};

			const request = store.add(group);

			request.onsuccess = () => resolve(groupId);
			request.onerror = () => {
				const error = request.error;
				reject(new Error(
					`Failed to create group '${ groupId }' for document '${ documentId }': `
					+ `${ error?.message ?? 'Unknown error' }`,
				));
			};
		});
	}

	async getGroups(documentId: string): Promise<ChangeGroup[]> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'groups' ], 'readonly');
			const store = tx.objectStore('groups');
			const index = store.index('documentId');
			const request = index.getAll(documentId);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				const error = request.error;
				reject(new Error(`Failed to get groups for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	async trimHistory(documentId: string, maxGroups: number): Promise<void> {
		if (maxGroups < 0 || !Number.isInteger(maxGroups))
			throw new Error('maxGroups must be a non-negative integer');

		const db = await this.ensureDB();
		const groups = await this.getGroups(documentId);

		if (groups.length <= maxGroups)
			return;

		// Keep only the newest maxGroups
		const toRemove = groups.slice(0, groups.length - maxGroups);
		const groupIdsToRemove = new Set(toRemove.map((g) => g.id));

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'groups', 'changes' ], 'readwrite');

			// Remove old groups
			const groupStore = tx.objectStore('groups');
			for (const group of toRemove)
				groupStore.delete(group.id);


			// Remove changes from old groups
			const changeStore = tx.objectStore('changes');
			const index = changeStore.index('documentId');
			const request = index.openCursor(documentId);

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const change = cursor.value as ChangeRecord;
					if (change.groupId && groupIdsToRemove.has(change.groupId))
						cursor.delete();

					cursor.continue();
				}
			};

			tx.oncomplete = async () => {
				try {
				// Recalculate change counts for remaining groups after transaction completes
					const remainingGroups = await this.getGroups(documentId);
					for (const group of remainingGroups) {
						const groupChanges = await this.getChanges(documentId, { groupId: group.id });
						await this.updateGroupChangeCount(documentId, group.id, groupChanges.length);
					}
					resolve();
				}
				catch (err) {
					reject(err);
				}
			};
			tx.onerror = () => {
				const error = tx.error;
				reject(new Error(`Failed to trim history for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	async clear(documentId: string): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(
				[ 'states', 'changes', 'groups', 'counters' ],
				'readwrite',
			);

			// Clear state
			tx.objectStore('states').delete(documentId);

			// Clear changes
			const changeStore = tx.objectStore('changes');
			const changeIndex = changeStore.index('documentId');
			const changeRequest = changeIndex.openKeyCursor(documentId);
			changeRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					changeStore.delete(cursor.primaryKey);
					cursor.continue();
				}
			};

			// Clear groups
			const groupStore = tx.objectStore('groups');
			const groupIndex = groupStore.index('documentId');
			const groupRequest = groupIndex.openKeyCursor(documentId);
			groupRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					groupStore.delete(cursor.primaryKey);
					cursor.continue();
				}
			};

			// Clear counter
			tx.objectStore('counters').delete(documentId);

			tx.oncomplete = () => resolve();
			tx.onerror = () => {
				const error = tx.error;
				reject(new Error(`Failed to clear data for document '${ documentId }': ${ error?.message ?? 'Unknown error' }`));
			};
		});
	}

	/**
	 * @internal
	 */
	async updateGroupChangeCount(
		documentId: string,
		groupId: string,
		count: number,
	): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([ 'groups' ], 'readwrite');
			const store = tx.objectStore('groups');
			const request = store.get(groupId);

			request.onsuccess = () => {
				const group = request.result;
				if (group) {
					group.changeCount = count;
					store.put(group);
				}
			};

			tx.oncomplete = () => resolve();
			tx.onerror = () => {
				const error = tx.error;
				reject(new Error(
					`Failed to update change count for group '${ groupId }' in document '${ documentId }': `
					+ `${ error?.message ?? 'Unknown error' }`,
				));
			};
		});
	}

	/**
 * Close the database connection
 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}

	/**
	 * Dispose implementation for resource cleanup
	 */
	[Symbol.dispose](): void {
		this.close();
	}

}
