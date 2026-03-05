import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir:       './tests/e2e',
	timeout:       30_000,
	retries:       0,
	workers:       1,
	fullyParallel: false,
	use:           {
		baseURL:  'http://127.0.0.1:4173',
		headless: true,
	},
	webServer: {
		command:             'pnpm exec vite preview --port 4173',
		url:                 'http://127.0.0.1:4173',
		reuseExistingServer: true,
		timeout:             15_000,
	},
});
