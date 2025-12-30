import { writeFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock file system
const mockFiles: Map<string, string> = new Map();

// Helper to normalize paths for cross-platform compatibility
const normalizePath = (path: string): string => {
	// Convert Windows paths to Unix-style and remove drive letters
	return path.replace(/\\/g, '/').replace(/^[A-Z]:/i, '');
};

// Track the current file being resolved for import.meta.resolve context
let currentResolvingFile = '';

vi.mock('node:fs', () => ({
	existsSync:   vi.fn((path: string) => mockFiles.has(normalizePath(path))),
	readFileSync: vi.fn((path: string, _options?: any) => {
		const normalized = normalizePath(path);
		const content = mockFiles.get(normalized);
		if (content === undefined)
			throw new Error(`ENOENT: no such file or directory, open '${ path }'`);

		// Track what file we're reading for import.meta.resolve context
		currentResolvingFile = normalized;

		return content;
	}),
	writeFileSync: vi.fn((path: string, content: string) => {
		mockFiles.set(normalizePath(path), content);
	}),
}));

vi.mock('node:url', () => ({
	fileURLToPath: vi.fn((url: string) => {
		// Convert file:// URL back to normalized path
		const match = url.match(/^file:\/\/(.+)$/);

		return match ? match[1] : url;
	}),
}));

// Mock import.meta.resolve by wrapping getTSConfigFromModule
vi.mock('../src/merge-tsconfig-utils.ts', async () => {
	const actual = await vi.importActual<typeof import('../src/merge-tsconfig-utils.js')>('../src/merge-tsconfig-utils.js');

	return {
		...actual,
		getTSConfigFromModule: vi.fn((module: string) => {
			// Resolve relative paths relative to the current file
			let resolvedPath: string;
			if (module.startsWith('./') || module.startsWith('../')) {
				const currentDir = currentResolvingFile.substring(0, currentResolvingFile.lastIndexOf('/'));
				const parts = currentDir.split('/').filter(Boolean);
				const moduleParts = module.split('/').filter(p => p !== '.');

				for (const part of moduleParts) {
					if (part === '..')
						parts.pop();
					else
						parts.push(part);
				}

				resolvedPath = '/' + parts.join('/');
			}
			else {
				// For non-relative paths, just use as-is
				resolvedPath = module;
			}

			// Use the real getTSConfigFromPath to load the file
			return actual.getTSConfigFromPath(resolvedPath);
		}),
	};
});

// Import after mocks
import { mergeTSConfig } from '../src/merge-tsconfig.js';
import { getTSConfigFromPath, mergeJson } from '../src/merge-tsconfig-utils.js';

// Helper to create mock tsconfig files
const createMockTSConfig = (path: string, config: Record<string, any>) => {
	mockFiles.set(path, JSON.stringify(config, null, 2));
};

describe('merge-tsconfig-utils', () => {
	beforeEach(() => {
		mockFiles.clear();
		vi.clearAllMocks();
	});

	describe('getTSConfigFromPath', () => {
		it('should load a simple tsconfig', () => {
			const config = {
				compilerOptions: {
					target: 'ES2020',
					module: 'ESNext',
				},
			};
			createMockTSConfig('/project/tsconfig.json', config);

			const result = getTSConfigFromPath('/project/tsconfig.json');

			expect(result).toEqual(config);
		});

		it('should return undefined for non-existent file', () => {
			const result = getTSConfigFromPath('/non-existent/tsconfig.json');

			expect(result).toBeUndefined();
		});

		it('should handle comments in tsconfig', () => {
			const configWithComments = `{
				// This is a comment
				"compilerOptions": {
					"target": "ES2020", // inline comment
					"module": "ESNext"
				}
			}`;
			mockFiles.set('/project/tsconfig.json', configWithComments);

			const result = getTSConfigFromPath('/project/tsconfig.json');

			expect(result).toEqual({
				compilerOptions: {
					target: 'ES2020',
					module: 'ESNext',
				},
			});
		});

		it('should handle trailing commas', () => {
			const configWithTrailingComma = `{
				"compilerOptions": {
					"target": "ES2020",
					"module": "ESNext",
				},
			}`;
			mockFiles.set('/project/tsconfig.json', configWithTrailingComma);

			const result = getTSConfigFromPath('/project/tsconfig.json');

			expect(result).toEqual({
				compilerOptions: {
					target: 'ES2020',
					module: 'ESNext',
				},
			});
		});
	});

	describe('mergeJson', () => {
		it('should merge simple objects', () => {
			const obj1 = { a: 1, b: 2 };
			const obj2 = { b: 3, c: 4 };

			const result = mergeJson(obj1 as any, obj2 as any);

			expect(result).toEqual({ a: 1, b: 3, c: 4 });
		});

		it('should merge nested objects', () => {
			const obj1 = {
				compilerOptions: {
					target: 'ES2020',
					lib:    [ 'ES2020' ],
				},
			};
			const obj2 = {
				compilerOptions: {
					module: 'ESNext',
					lib:    [ 'DOM' ],
				},
			};

			const result = mergeJson(obj1 as any, obj2 as any);

			expect(result).toEqual({
				compilerOptions: {
					target: 'ES2020',
					module: 'ESNext',
					lib:    [ 'DOM' ], // Arrays are replaced, not merged
				},
			});
		});

		it('should merge multiple sources', () => {
			const obj1 = { a: 1 };
			const obj2 = { b: 2 };
			const obj3 = { c: 3 };

			const result = mergeJson(obj1 as any, obj2 as any, obj3 as any);

			expect(result).toEqual({ a: 1, b: 2, c: 3 });
		});

		it('should prioritize later sources', () => {
			const obj1 = { value: 'first' };
			const obj2 = { value: 'second' };
			const obj3 = { value: 'third' };

			const result = mergeJson(obj1 as any, obj2 as any, obj3 as any);

			expect(result).toEqual({ value: 'third' });
		});

		it('should merge deeply nested objects', () => {
			const obj1 = {
				level1: {
					level2: {
						level3: {
							value: 'deep',
						},
					},
				},
			};
			const obj2 = {
				level1: {
					level2: {
						level3: {
							otherValue: 'also-deep',
						},
					},
				},
			};

			const result = mergeJson(obj1 as any, obj2 as any);

			expect(result).toEqual({
				level1: {
					level2: {
						level3: {
							value:      'deep',
							otherValue: 'also-deep',
						},
					},
				},
			});
		});

		it('should replace arrays rather than merge them', () => {
			const obj1 = { arr: [ 1, 2, 3 ] };
			const obj2 = { arr: [ 4, 5 ] };

			const result = mergeJson(obj1 as any, obj2 as any);

			expect(result).toEqual({ arr: [ 4, 5 ] });
		});
	});
});

describe('mergeTSConfig', () => {
	beforeEach(() => {
		mockFiles.clear();
		vi.clearAllMocks();
	});

	it('should merge simple tsconfig without extends', () => {
		const config = {
			compilerOptions: {
				target: 'ES2020',
				module: 'ESNext',
			},
		};
		createMockTSConfig('/project/tsconfig.json', config);

		mergeTSConfig('/project/tsconfig.json');

		// Check that writeFileSync was called with merged config (without extends)
		expect(writeFileSync).toHaveBeenCalled();
		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		expect(writtenContent).toContain('"target"');
		expect(writtenContent).not.toContain('"extends"');
	});

	it('should merge tsconfig with single extends', () => {
		const baseConfig = {
			compilerOptions: {
				strict: true,
				target: 'ES2020',
			},
		};
		const projectConfig = {
			extends:         './tsconfig.base.json',
			compilerOptions: {
				outDir: './dist',
			},
		};

		createMockTSConfig('/project/tsconfig.base.json', baseConfig);
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written).toEqual({
			compilerOptions: {
				strict: true,
				target: 'ES2020',
				outDir: './dist',
			},
		});
		expect(written.extends).toBeUndefined();
	});

	it('should merge tsconfig with multi-level extends chain', () => {
		const rootConfig = {
			compilerOptions: {
				strict: true,
				target: 'ES2020',
			},
		};
		const baseConfig = {
			extends:         './tsconfig.root.json',
			compilerOptions: {
				module: 'ESNext',
			},
		};
		const projectConfig = {
			extends:         './tsconfig.base.json',
			compilerOptions: {
				outDir: './dist',
			},
		};

		createMockTSConfig('/project/tsconfig.root.json', rootConfig);
		createMockTSConfig('/project/tsconfig.base.json', baseConfig);
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written).toEqual({
			compilerOptions: {
				strict: true,
				target: 'ES2020',
				module: 'ESNext',
				outDir: './dist',
			},
		});
		expect(written.extends).toBeUndefined();
	});

	it('should override base config values with local values', () => {
		const baseConfig = {
			compilerOptions: {
				target: 'ES2015',
				strict: true,
			},
		};
		const projectConfig = {
			extends:         './tsconfig.base.json',
			compilerOptions: {
				target: 'ES2020', // Override
			},
		};

		createMockTSConfig('/project/tsconfig.base.json', baseConfig);
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written.compilerOptions.target).toBe('ES2020');
		expect(written.compilerOptions.strict).toBe(true);
	});

	it('should merge include and exclude arrays', () => {
		const baseConfig = {
			include: [ 'src/**/*' ],
			exclude: [ 'node_modules' ],
		};
		const projectConfig = {
			extends: './tsconfig.base.json',
			include: [ 'tests/**/*' ],
		};

		createMockTSConfig('/project/tsconfig.base.json', baseConfig);
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		// Arrays are replaced, not merged
		expect(written.include).toEqual([ 'tests/**/*' ]);
		expect(written.exclude).toEqual([ 'node_modules' ]);
	});

	it('should handle tsconfig with no extends gracefully', () => {
		const config = {
			compilerOptions: {
				target: 'ES2020',
			},
		};
		createMockTSConfig('/project/tsconfig.json', config);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written).toEqual({
			compilerOptions: {
				target: 'ES2020',
			},
		});
	});

	it('should handle extends pointing to non-existent file', () => {
		const projectConfig = {
			extends:         './non-existent.json',
			compilerOptions: {
				target: 'ES2020',
			},
		};
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		// Should not throw, just skip the missing base
		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		// Should only have the project config
		expect(written.compilerOptions.target).toBe('ES2020');
		expect(written.extends).toBeUndefined();
	});

	it('should handle deep extends chain (4+ levels)', () => {
		const level1 = { compilerOptions: { strict: true } };
		const level2 = { extends: './level1.json', compilerOptions: { target: 'ES2020' } };
		const level3 = { extends: './level2.json', compilerOptions: { module: 'ESNext' } };
		const level4 = { extends: './level3.json', compilerOptions: { outDir: './dist' } };

		createMockTSConfig('/project/level1.json', level1);
		createMockTSConfig('/project/level2.json', level2);
		createMockTSConfig('/project/level3.json', level3);
		createMockTSConfig('/project/level4.json', level4);

		mergeTSConfig('/project/level4.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written).toEqual({
			compilerOptions: {
				strict: true,
				target: 'ES2020',
				module: 'ESNext',
				outDir: './dist',
			},
		});
	});

	it('should preserve non-compilerOptions fields', () => {
		const baseConfig = {
			compilerOptions: { strict: true },
		};
		const projectConfig = {
			extends:         './tsconfig.base.json',
			compilerOptions: { outDir: './dist' },
			include:         [ 'src/**/*' ],
			exclude:         [ 'node_modules' ],
			references:      [ { path: '../core' } ],
		};

		createMockTSConfig('/project/tsconfig.base.json', baseConfig);
		createMockTSConfig('/project/tsconfig.json', projectConfig);

		mergeTSConfig('/project/tsconfig.json');

		const writtenContent = (writeFileSync as any).mock.calls[0][1];
		const written = JSON.parse(writtenContent);

		expect(written.include).toEqual([ 'src/**/*' ]);
		expect(written.exclude).toEqual([ 'node_modules' ]);
		expect(written.references).toEqual([ { path: '../core' } ]);
	});
});
