import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PackageJson } from '../src/package-json.ts';


// Mock file system
const mockFileSystem: Map<string, string> = new Map();
const mockPackages: Map<string, PackageJson> = new Map();

// Mock the node:fs module
vi.mock('node:fs', () => ({
	existsSync: (path: string) => {
		const normalized = path.replaceAll('\\', '/');

		return mockFileSystem.has(normalized);
	},
	readFileSync: (path: string) => {
		const normalized = path.replaceAll('\\', '/');
		const content = mockFileSystem.get(normalized);
		if (!content)
			throw new Error(`File not found: ${ path }`);

		return content;
	},
}));

// Mock the node:fs/promises module
vi.mock('node:fs/promises', () => ({
	glob: async function* (pattern: string) {
		const regex = pattern
			.replace(/\*\*/g, '§DOUBLESTAR§')
			.replace(/\*/g, '§STAR§')
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
			.replace(/§DOUBLESTAR§/g, '.*')
			.replace(/§STAR§/g, '[^/]*');

		const re = new RegExp(`^${ regex }$`);

		for (const path of mockFileSystem.keys()) {
			if (re.test(path))
				yield path;
		}
	},
}));

// Mock process.cwd()
vi.spyOn(process, 'cwd').mockReturnValue('/root');

import {
	__resetPackageCache,
	getPackageBuildOrder,
	getPackageDeps,
	getPackageDir,
	getWorkspaceDeps,
} from '../src/find-build-order.ts';


describe('find-build-order', () => {
	beforeEach(() => {
		mockFileSystem.clear();
		mockPackages.clear();

		// Reset the module cache
		__resetPackageCache();

		// Setup a default workspace file without overrides
		const defaultYaml = `packages:
  - packages/**/*

catalog:
  lodash: ^4.0.0
  react: ^18.0.0

overrides:
`;
		mockFileSystem.set('/root/pnpm-workspace.yaml', defaultYaml);
	});

	const setupWorkspaceOverrides = (overrides: Record<string, string>) => {
		const yamlContent = [
			'packages:',
			'  - packages/**/*',
			'',
			'overrides:',
			...Object.entries(overrides).map(([ name, version ]) => `  '${ name }': ${ version }`),
		].join('\n');

		mockFileSystem.set('/root/pnpm-workspace.yaml', yamlContent);
	};

	const setupMockPackage = (
		name: string,
		options: {
			path?:            string;
			dependencies?:    Record<string, string>;
			devDependencies?: Record<string, string>;
			main?:            string;
			exports?:         PackageJson['exports'];
			hasBuiltFiles?:   boolean;
		} = {},
	) => {
		const {
			path = `/root/packages/${ name }`,
			dependencies = {},
			devDependencies = {},
			main,
			exports,
			hasBuiltFiles = false,
		} = options;

		const packageJson: PackageJson = {
			name,
			version: '1.0.0',
			dependencies,
			devDependencies,
			main,
			exports,
		};

		const packagePath = `${ path }/package.json`;
		mockFileSystem.set(packagePath, JSON.stringify(packageJson));
		mockPackages.set(name, packageJson);

		// Add built files if specified
		if (hasBuiltFiles) {
			if (main)
				mockFileSystem.set(`${ path }/${ main }`, '// built file');

			if (exports) {
				const extractPaths = (exp: any): string[] => {
					const paths: string[] = [];
					for (const value of Object.values(exp)) {
						if (typeof value === 'string')
							paths.push(value);
						else if (typeof value === 'object' && value !== null)
							paths.push(...extractPaths(value));
					}

					return paths;
				};

				const exportPaths = extractPaths(exports);
				for (const exportPath of exportPaths) {
					if (exportPath) {
						// Normalize path by removing leading ./
						const normalizedPath = exportPath.startsWith('./')
							? exportPath.slice(2)
							: exportPath;
						mockFileSystem.set(`${ path }/${ normalizedPath }`, '// built export');
					}
				}
			}
		}

		return packageJson;
	};

	describe('getPackageDir', () => {
		it('should return the directory of a package', async () => {
			setupMockPackage('test-package', { path: '/root/packages/test-package' });

			const dir = await getPackageDir('test-package');
			expect(dir).toBe('/root/packages/test-package');
		});

		it('should return undefined for non-existent package', async () => {
			setupMockPackage('test-package', { path: '/root/packages/test-package' });

			const dir = await getPackageDir('non-existent');
			expect(dir).toBeUndefined();
		});

		it('should handle multiple packages', async () => {
			setupMockPackage('package-a', { path: '/root/packages/package-a' });
			setupMockPackage('package-b', { path: '/root/packages/package-b' });
			setupMockPackage('package-c', { path: '/root/other/package-c' });

			const dirA = await getPackageDir('package-a');
			const dirB = await getPackageDir('package-b');
			const dirC = await getPackageDir('package-c');

			expect(dirA).toBe('/root/packages/package-a');
			expect(dirB).toBe('/root/packages/package-b');
			expect(dirC).toBe('/root/other/package-c');
		});
	});

	describe('getPackageDeps', () => {
		it('should return all dependencies', async () => {
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'lodash': '^4.0.0',
					'react':  '^18.0.0',
				},
			});

			const deps = getPackageDeps(pkg);
			expect(deps).toEqual([
				[ 'lodash', '^4.0.0' ],
				[ 'react', '^18.0.0' ],
			]);
		});

		it('should return dev dependencies', async () => {
			const pkg = setupMockPackage('test-package', {
				devDependencies: {
					'vitest':     '^1.0.0',
					'typescript': '^5.0.0',
				},
			});

			const deps = getPackageDeps(pkg);
			expect(deps).toEqual([
				[ 'vitest', '^1.0.0' ],
				[ 'typescript', '^5.0.0' ],
			]);
		});

		it('should combine dependencies and devDependencies', async () => {
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'react': '^18.0.0',
				},
				devDependencies: {
					'vitest': '^1.0.0',
				},
			});

			const deps = getPackageDeps(pkg);
			expect(deps).toHaveLength(2);
			expect(deps).toContainEqual([ 'react', '^18.0.0' ]);
			expect(deps).toContainEqual([ 'vitest', '^1.0.0' ]);
		});
	});

	describe('getWorkspaceDeps', () => {
		it('should filter only workspace dependencies', async () => {
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'@workspace/pkg-a': 'workspace:*',
					'lodash':           '^4.0.0',
					'@workspace/pkg-b': 'workspace:^',
				},
				devDependencies: {
					'@workspace/pkg-c': 'workspace:~',
					'vitest':           '^1.0.0',
				},
			});

			const deps = getWorkspaceDeps(pkg);
			expect(deps).toEqual([
				'@workspace/pkg-a',
				'@workspace/pkg-b',
				'@workspace/pkg-c',
			]);
		});

		it('should return empty array when no workspace deps', async () => {
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'lodash': '^4.0.0',
					'react':  '^18.0.0',
				},
			});

			const deps = getWorkspaceDeps(pkg);
			expect(deps).toEqual([]);
		});

		it('should detect catalog: references to workspace packages', async () => {
			// Setup workspace overrides
			setupWorkspaceOverrides({
				'@workspace/pkg-a': 'workspace:^',
				'@workspace/pkg-b': 'workspace:^',
			});

			// Setup workspace packages first
			setupMockPackage('@workspace/pkg-a');
			setupMockPackage('@workspace/pkg-b');

			// Trigger package lookup
			await getPackageDir('@workspace/pkg-a');

			// Now setup a package that uses catalog: to reference them
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'@workspace/pkg-a': 'catalog:',
					'lodash':           '^4.0.0',
					'@workspace/pkg-b': 'catalog:',
				},
			});

			const deps = getWorkspaceDeps(pkg);
			expect(deps).toContain('@workspace/pkg-a');
			expect(deps).toContain('@workspace/pkg-b');
			expect(deps).not.toContain('lodash');
		});

		it('should not include catalog: references to external packages', async () => {
			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'lodash': 'catalog:',
					'react':  'catalog:',
				},
			});

			const deps = getWorkspaceDeps(pkg);
			expect(deps).toEqual([]);
		});

		it('should not treat catalog: as workspace dep if not in overrides', async () => {
			// Setup workspace package but NO override
			setupMockPackage('@workspace/pkg-a');

			// Trigger package lookup
			await getPackageDir('@workspace/pkg-a');

			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'@workspace/pkg-a': 'catalog:',
				},
			});

			const deps = getWorkspaceDeps(pkg);
			expect(deps).toEqual([]);
		});

		it('should handle malformed YAML overrides gracefully', async () => {
			// Setup malformed YAML (should not crash)
			const yamlContent = `
packages:
  - packages/**/*

overrides:
  @workspace/pkg-a workspace:^
  invalid line without colon
  : invalid line with just colon
`;
			mockFileSystem.set('/root/pnpm-workspace.yaml', yamlContent);

			setupMockPackage('@workspace/pkg-a');
			await getPackageDir('@workspace/pkg-a');

			const pkg = setupMockPackage('test-package', {
				dependencies: {
					'@workspace/pkg-a': 'catalog:',
				},
			});

			// Should not crash and should handle gracefully
			const deps = getWorkspaceDeps(pkg);
			// Since the YAML is malformed, it won't be parsed correctly
			expect(deps).toBeDefined();
		});
	});

	describe('getPackageBuildOrder', () => {
		it('should return single package with no dependencies', async () => {
			setupMockPackage('standalone-package');

			const buildOrder = await getPackageBuildOrder('standalone-package');
			expect(buildOrder).toEqual([ 'standalone-package' ]);
		});

		it('should build dependencies before dependents', async () => {
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: {
					'pkg-a': 'workspace:*',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-b');
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b' ]);
		});

		it('should handle multi-level dependencies', async () => {
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-c', {
				dependencies: { 'pkg-b': 'workspace:*' },
			});

			const buildOrder = await getPackageBuildOrder('pkg-c');
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b', 'pkg-c' ]);
		});

		it('should handle diamond dependencies correctly', async () => {
			//     D
			//    / \
			//   B   C
			//    \ /
			//     A
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-c', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-d', {
				dependencies: {
					'pkg-b': 'workspace:*',
					'pkg-c': 'workspace:*',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-d');

			// pkg-a should come first, then b and c, then d
			const indexA = buildOrder.indexOf('pkg-a');
			const indexB = buildOrder.indexOf('pkg-b');
			const indexC = buildOrder.indexOf('pkg-c');
			const indexD = buildOrder.indexOf('pkg-d');

			expect(indexA).toBeLessThan(indexB);
			expect(indexA).toBeLessThan(indexC);
			expect(indexB).toBeLessThan(indexD);
			expect(indexC).toBeLessThan(indexD);
		});

		it('should include devDependencies in build order', async () => {
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				devDependencies: { 'pkg-a': 'workspace:*' },
			});

			const buildOrder = await getPackageBuildOrder('pkg-b');
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b' ]);
		});

		it('should return empty array for non-existent package', async () => {
			const buildOrder = await getPackageBuildOrder('non-existent');
			expect(buildOrder).toEqual([]);
		});

		it('should ignore built packages when flag is set', async () => {
			setupMockPackage('pkg-a', {
				main:          'dist/index.js',
				hasBuiltFiles: true,
			});
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});

			const buildOrder = await getPackageBuildOrder('pkg-b', true);
			expect(buildOrder).toEqual([ 'pkg-b' ]);
		});

		it('should include unbuilt packages even when ignoreBuiltPackages is true', async () => {
			setupMockPackage('pkg-a', {
				main:          'dist/index.js',
				hasBuiltFiles: false, // Not built
			});
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});

			const buildOrder = await getPackageBuildOrder('pkg-b', true);
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b' ]);
		});

		it('should check exports for built files', async () => {
			setupMockPackage('pkg-a', {
				exports: {
					'.': {
						import: './dist/index.js',
						types:  './dist/index.d.ts',
					},
				},
				hasBuiltFiles: true,
			});
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});

			const buildOrder = await getPackageBuildOrder('pkg-b', true);
			expect(buildOrder).toEqual([ 'pkg-b' ]);
		});

		it('should handle complex dependency graph', async () => {
			//       E
			//      /|\
			//     B C D
			//      \|/
			//       A
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-c', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-d', {
				dependencies: { 'pkg-a': 'workspace:*' },
			});
			setupMockPackage('pkg-e', {
				dependencies: {
					'pkg-b': 'workspace:*',
					'pkg-c': 'workspace:*',
					'pkg-d': 'workspace:*',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-e');

			const indexA = buildOrder.indexOf('pkg-a');
			const indexB = buildOrder.indexOf('pkg-b');
			const indexC = buildOrder.indexOf('pkg-c');
			const indexD = buildOrder.indexOf('pkg-d');
			const indexE = buildOrder.indexOf('pkg-e');

			// A should be first
			expect(indexA).toBeLessThan(indexB);
			expect(indexA).toBeLessThan(indexC);
			expect(indexA).toBeLessThan(indexD);

			// B, C, D should all come before E
			expect(indexB).toBeLessThan(indexE);
			expect(indexC).toBeLessThan(indexE);
			expect(indexD).toBeLessThan(indexE);
		});

		it('should handle packages with external dependencies', async () => {
			setupMockPackage('pkg-a', {
				dependencies: {
					'lodash': '^4.0.0',
					'react':  '^18.0.0',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-a');
			expect(buildOrder).toEqual([ 'pkg-a' ]);
		});

		it('should handle catalog: dependencies to workspace packages', async () => {
			setupWorkspaceOverrides({
				'pkg-a': 'workspace:^',
			});

			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: {
					'pkg-a':  'catalog:',
					'lodash': 'catalog:',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-b');
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b' ]);
		});

		it('should handle mixed workspace, catalog, and external dependencies', async () => {
			setupMockPackage('pkg-a');
			setupMockPackage('pkg-b', {
				dependencies: {
					'pkg-a':  'workspace:*',
					'lodash': '^4.0.0',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-b');
			expect(buildOrder).toEqual([ 'pkg-a', 'pkg-b' ]);
		});

		it('should not duplicate packages in build order', async () => {
			//     C
			//    / \
			//   A   B
			//    \ /
			//     D (common dependency)
			setupMockPackage('pkg-d');
			setupMockPackage('pkg-a', {
				dependencies: { 'pkg-d': 'workspace:*' },
			});
			setupMockPackage('pkg-b', {
				dependencies: { 'pkg-d': 'workspace:*' },
			});
			setupMockPackage('pkg-c', {
				dependencies: {
					'pkg-a': 'workspace:*',
					'pkg-b': 'workspace:*',
				},
			});

			const buildOrder = await getPackageBuildOrder('pkg-c');

			// Each package should appear only once
			const uniquePackages = new Set(buildOrder);
			expect(buildOrder.length).toBe(uniquePackages.size);
			expect(buildOrder).toContain('pkg-d');
			expect(buildOrder).toContain('pkg-a');
			expect(buildOrder).toContain('pkg-b');
			expect(buildOrder).toContain('pkg-c');
		});
	});
});
