import { getAllModules } from '@arcmantle/morph/server/features/modules/modules-behavior.js';
import { createResponse } from '@arcmantle/morph/server/utilities/create-response.js';
import type { RequestHandler } from 'express';


export const get: RequestHandler[] = [
	async (req, res) => {
		const modules = getAllModules();

		res.send(createResponse(modules, ''));
	},
];
