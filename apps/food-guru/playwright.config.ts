import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir:       './tests/e2e',
	timeout:       30_000,
	retries:       0,
	workers:       1,
	fullyParallel: false,
	use:           {
		baseURL:  'http://127.0.0.1:4178',
		headless: true,
	},
	webServer: {
		command:             'pnpm --dir ./client build && pnpm --dir ./client preview --host 127.0.0.1 --port 4178 --strictPort',
		url:                 'http://127.0.0.1:4178',
		reuseExistingServer: true,
		timeout:             120_000,
	},
});
