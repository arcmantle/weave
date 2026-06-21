#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


const args = yargs(hideBin(process.argv));

args.command(
	'pnpm-to-semver',
	'Convert pnpm workspace and catalog specifiers to semver versions',
	() => {},
	async (argv) => {
		console.log('this has been moved to an action');
	},
).option('verbose', {
	alias:       'v',
	type:        'boolean',
	description: 'Run with verbose logging',
});


args.parse();
