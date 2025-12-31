import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - history reference bug', () => {
	test('BUG: mutating nested object after change corrupts history', () => {
		const state = chronicle({
			user: { name: 'Alice', age: 30 },
		});

		// Disable auto-grouping for predictable history
		chronicle.configure(state, { mergeUngrouped: false });

		// Record the initial state
		const initialUser = state.user;

		// Change the user object
		state.user = { name: 'Bob', age: 25 };

		// Now mutate the OLD user object (which is still referenced in history)
		initialUser.name = 'CORRUPTED';
		initialUser.age = 999;

		// Get history to check what was recorded
		const history = chronicle.getHistory(state);

		// Find the 'user' set record
		const record = history.find(r => r.path[0] === 'user' && r.type === 'set')!;
		expect(record).toBeDefined();

		console.log('Old value in history:', record.oldValue);
		console.log('Expected: { name: "Alice", age: 30 }');
		console.log('Actual:', record.oldValue);

		// FIXED: oldValue should now be cloned and protected from mutations
		expect(record.oldValue).toEqual({ name: 'Alice', age: 30 });
		// It will actually be { name: 'CORRUPTED', age: 999 }

		// Try to undo all changes
		const historyLength = chronicle.getHistory(state).length;
		chronicle.undo(state, historyLength);

		// FIXED: Should restore the original value, not the corrupted reference
		expect(state.user).toEqual({ name: 'Alice', age: 30 });
	});

	test('BUG: mutating nested array elements corrupts history', () => {
		const state = chronicle({
			items: [ { id: 1, value: 'A' }, { id: 2, value: 'B' } ],
		});

		chronicle.configure(state, { mergeUngrouped: false });

		const originalItems = state.items;
		const firstItem = state.items[0];

		// Replace the array
		state.items = [ { id: 3, value: 'C' } ];

		// Mutate the old array and its contents
		firstItem!.value = 'CORRUPTED';
		originalItems.push({ id: 999, value: 'BAD' });

		const history = chronicle.getHistory(state);
		const record = history[0]!;

		console.log('Old value in history:', record.oldValue);

		// BUG: The old value is corrupted
		expect(record.oldValue).toEqual([ { id: 1, value: 'A' }, { id: 2, value: 'B' } ]);
		// Will fail - the array reference was mutated
	});

	test('BUG: modifying object properties before reassignment corrupts history', () => {
		const state = chronicle({
			config: { theme: 'dark', lang: 'en' },
		});

		chronicle.configure(state, { mergeUngrouped: false });

		// Modify a property
		state.config.theme = 'light';

		// Get the current config (which is now { theme: 'light', lang: 'en' })
		const currentConfig = state.config;

		// Replace the entire config object
		state.config = { theme: 'auto', lang: 'fr' };

		// Later, someone mutates what used to be the config
		currentConfig.theme = 'CORRUPTED';

		// Check the second history entry (replacing config)
		const history = chronicle.getHistory(state);
		const replaceRecord = history[1]!; // Second change

		console.log('Old value for config replacement:', replaceRecord.oldValue);

		// BUG: oldValue should be { theme: 'light', lang: 'en' }
		// but it's been mutated to { theme: 'CORRUPTED', lang: 'en' }
		expect(replaceRecord.oldValue).toEqual({ theme: 'light', lang: 'en' });
	});

	test('BUG: complex nested mutations corrupt entire history chain', () => {
		const state = chronicle({
			data: {
				users: [ { id: 1, profile: { name: 'Alice', settings: { theme: 'dark' } } } ],
			},
		});

		chronicle.configure(state, { mergeUngrouped: false });

		// Get references to nested objects
		const _originalData = state.data;
		const _originalUsers = state.data.users;
		const originalUser = state.data.users[0];
		const originalProfile = state.data.users[0]!.profile;

		// Make a series of changes
		state.data.users[0]!.profile.name = 'Bob'; // Change 1
		state.data.users[0]!.profile.settings.theme = 'light'; // Change 2
		state.data.users.push({ id: 2, profile: { name: 'Charlie', settings: { theme: 'auto' } } }); // Change 3

		console.log('After changes, before corruption:');
		console.log('state.data.users[0].profile.name:', state.data.users[0]!.profile.name);

		// Now corrupt all the references
		originalProfile.name = 'CORRUPTED';
		originalProfile.settings.theme = 'CORRUPTED';
		originalUser!.id = 999;

		console.log('After corrupting references:');
		console.log('state.data.users[0].profile.name:', state.data.users[0]!.profile.name);
		console.log('This shows that mutating originalProfile mutates current state');

		// DON'T mutate the array itself as that would record more history
		// originalUsers[0] = { id: 999, profile: { name: 'BAD', settings: { theme: 'BAD' } } };

		// Try to undo everything
		const historyCount = chronicle.getHistory(state).length;
		console.log('History records before undo:', historyCount);
		chronicle.undo(state, historyCount);

		console.log('After undo:');
		console.log('state.data.users[0]!.profile.name:', state.data.users[0]!.profile.name);

		// FIXED: Should restore to values before any changes were made
		expect(state.data.users[0]!.profile.name).toBe('Alice');
		expect(state.data.users[0]!.profile.settings.theme).toBe('dark');
		expect(state.data.users.length).toBe(1);
	});
});
