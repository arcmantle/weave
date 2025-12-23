#!/usr/bin/env node

import { ProspectorCLI } from '../dist/cli.js';

// eslint-disable-next-line no-undef
const cli = new ProspectorCLI(process.argv.slice(2));
await cli.run();
