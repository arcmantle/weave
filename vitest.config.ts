
import { defineConfig } from 'vitest/config';


export default defineConfig({
	test: {
		projects: [
			'packages/core/**/vitest.config.ts',
			'packages/dev-tools/**/vitest.config.ts',
			'packages/lit/**/vitest.config.ts',
		],
	},
});
