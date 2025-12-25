import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals:     true,
		// Increase test timeout for git operations
		testTimeout: 10000, // 10s instead of default 5s
	},
});
