import { join } from 'node:path';

import { defineConfig, type UserConfig } from 'vite';


export default defineConfig({
	root: join(process.cwd(), 'demo'),
}) as UserConfig;
