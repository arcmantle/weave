import { defineConfig } from 'vite';

import viteDimensionConfig from '@arcmantle/vite-dimension-config';


// https://vitejs.dev/config/
export default defineConfig({
	...viteDimensionConfig({
		dimension: 'chessmaster',
		port:      6322,
		server:    {
			host: 'http://localhost',
			port: 8090,
		},
		auth: {
			username: 'user1@arcmantle.com',
			password: 'user1@arcmantle.com',
		},
	}),
});
