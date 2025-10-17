#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { pnpmToSemver } from '../pnpm-to-semver/pnpm-to-semver.ts';

const args = yargs(hideBin(process.argv));

args.command(
	'pnpm-to-semver',
	'Convert pnpm workspace and catalog specifiers to semver versions',
	() => {},
	async (argv) => {
		console.log('serve command called', argv);
		pnpmToSemver();
	},
).option('verbose', {
	alias:       'v',
	type:        'boolean',
	description: 'Run with verbose logging',
});


args.parse();
