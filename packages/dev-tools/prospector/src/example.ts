#!/usr/bin/env node

/**
 * Simple example of using Prospector programmatically
 */

import { calculateVersion, suggestVersionBump } from './index.js';

console.log('=== Prospector Example ===\n');

// Get current version information (now async!)
const versionInfo = await calculateVersion({
	mainBranch: 'main',
	tagPrefix:  'v',
});

console.log('Current Version Information:');
console.log('----------------------------');
console.log(`Version:           ${ versionInfo.version }`);
console.log(`Branch:            ${ versionInfo.branch }`);
console.log(`Is Main Branch:    ${ versionInfo.isMainBranch }`);
console.log(`Commits Since Tag: ${ versionInfo.commitsSinceTag }`);
console.log(`Current Commit:    ${ versionInfo.currentCommit.slice(0, 8) }`);

if (versionInfo.lastTag) {
	console.log(`\nLast Version Tag:`);
	console.log(`  Tag:     ${ versionInfo.lastTag.tag }`);
	console.log(`  Version: ${ versionInfo.lastTag.version.version }`);
	console.log(`  Commit:  ${ versionInfo.lastTag.commit.slice(0, 8) }`);
}

console.log('\n=== Version Bump Suggestions ===');
console.log(`Next Patch:  ${ await suggestVersionBump('patch') }`);
console.log(`Next Minor:  ${ await suggestVersionBump('minor') }`);
console.log(`Next Major:  ${ await suggestVersionBump('major') }`);
