import viteDimensionConfig from '@arcmantle/vite-dimension-config';
import { defineConfig } from 'vite';


// https://vitejs.dev/config/
export default defineConfig({
	...viteDimensionConfig({
		dimension: 'timekeeper',
		port:      6321,
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
