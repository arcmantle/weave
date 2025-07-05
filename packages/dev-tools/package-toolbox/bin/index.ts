#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { toolbox } from '../src/toolbox/toolbox.ts';


const cmds = await toolbox();
const noop = () => { /*  */ };

// eslint-disable-next-line no-undef
let cli = yargs(hideBin(process.argv)).demandCommand(1);

cli = cli.command(
	'build-indexes',
	'build indexes at configured locations.',
	noop,
	async () => {
		cmds.indexBuilder();
	},
).command(
	'build-exports',
	'build package.json exports as defined in config.',
	noop,
	async () => {
		cmds.exportsBuilder();
	},
).command(
	'copy',
	'Copies files base on the profile key supplied.',
	noop,
	async (args) => {
		const { profile } = args;
		if (typeof profile !== 'string')
			throw ('Invalid profile arguments: ' + JSON.stringify(args));

		cmds.copy(profile);
	},
);

cli.parse();
