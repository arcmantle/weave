import { describe, expect, it } from 'vitest';

import {
	getPackageBuildOrder,
	getPackageDir,
} from '../src/find-build-order.ts';


describe('integration tests with real workspace', () => {
	it('should find @arcmantle/adapter-element package', async () => {
		const packageDir = await getPackageDir('@arcmantle/adapter-element');
		expect(packageDir).toBeDefined();
		expect(packageDir).toContain('adapter-element');
	});

	it('should build order for @arcmantle/adapter-element without duplicates', async () => {
		const buildOrder = await getPackageBuildOrder('@arcmantle/adapter-element', false);

		console.log('Build order for @arcmantle/adapter-element:', buildOrder);

		// Check for duplicates
		const uniquePackages = new Set(buildOrder);
		expect(buildOrder.length).toBe(uniquePackages.size);

		// Count occurrences
		const counts = buildOrder.reduce((acc, pkg) => {
			acc[pkg] = (acc[pkg] || 0) + 1;

			return acc;
		}, {} as Record<string, number>);

		// No package should appear more than once
		Object.entries(counts).forEach(([ pkg, count ]) => {
			if (count > 1)
				console.error(`Package ${ pkg } appears ${ count } times!`);

			expect(count).toBe(1);
		});

		// The target package should be in the build order
		expect(buildOrder).toContain('@arcmantle/adapter-element');
	});

	it('should build order for @arcmantle/elements without duplicates', async () => {
		const buildOrder = await getPackageBuildOrder('@arcmantle/elements', false);

		console.log('Build order for @arcmantle/elements:', buildOrder);

		// Check for duplicates
		const uniquePackages = new Set(buildOrder);
		expect(buildOrder.length).toBe(uniquePackages.size);

		// Count occurrences
		const counts = buildOrder.reduce((acc, pkg) => {
			acc[pkg] = (acc[pkg] || 0) + 1;

			return acc;
		}, {} as Record<string, number>);

		// No package should appear more than once
		Object.entries(counts).forEach(([ pkg, count ]) => {
			if (count > 1)
				console.error(`Package ${ pkg } appears ${ count } times!`);

			expect(count).toBe(1);
		});
	});

	it('should correctly resolve catalog: dependencies via workspace overrides', async () => {
		// @arcmantle/adapter-element uses catalog: for @arcmantle/injector and @arcmantle/library
		// These should be resolved as workspace dependencies via overrides
		const buildOrder = await getPackageBuildOrder('@arcmantle/adapter-element', false);

		console.log('Build order with catalog dependencies:', buildOrder);

		// Should not be just the single package - should include dependencies
		expect(buildOrder.length).toBeGreaterThan(1);

		// adapter-element should be last in its own build order
		expect(buildOrder[buildOrder.length - 1]).toBe('@arcmantle/adapter-element');
	});

	it('should respect dependency order in real workspace', async () => {
		// Test that dependencies come before dependents
		const buildOrder = await getPackageBuildOrder('@arcmantle/elements', false);

		// Find dependencies like @arcmantle/lit-utilities and @arcmantle/lit-localize
		const elementsIndex = buildOrder.indexOf('@arcmantle/elements');
		const litUtilitiesIndex = buildOrder.indexOf('@arcmantle/lit-utilities');
		const litLocalizeIndex = buildOrder.indexOf('@arcmantle/lit-localize');

		// If these dependencies exist in the build order, they must come before elements
		if (litUtilitiesIndex !== -1)
			expect(litUtilitiesIndex).toBeLessThan(elementsIndex);

		if (litLocalizeIndex !== -1)
			expect(litLocalizeIndex).toBeLessThan(elementsIndex);
	});
});
