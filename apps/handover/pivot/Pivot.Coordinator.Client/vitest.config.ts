import type { UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		globals:     true,
		include:     [ 'src/**/*.test.ts' ],
		coverage:    {
			provider: 'v8',
			reporter: [ 'text', 'html', 'lcov' ],
			include:  [ 'src/**/*.ts' ],
			exclude:  [ 'src/**/*.test.ts', 'src/main.ts' ],
		},
	},
}) as UserConfig;
