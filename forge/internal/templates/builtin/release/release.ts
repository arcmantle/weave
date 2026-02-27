import { command, info, success, error as logError, execSimple, exec } from '#helpers';

const cmd = command('__NAME__', 'Version bump, changelog, git tag, and publish');
const version = cmd.arg('version', 'Semantic version to release (e.g. 1.2.3)');
const dryRun = cmd.flag('dry-run', 'Show what would happen without making changes');
const changelog = cmd.option('changelog', 'Changelog file path', '__VAR_CHANGELOG_FILE__');
cmd.parse();

const tag = `v${version.value}`;

if (dryRun.value) {
	info(`[dry-run] would release ${tag}`);
	info(`[dry-run] changelog: ${changelog.value}`);
	process.exit(0);
}

// Ensure working tree is clean.
info('checking git status...');
try {
	execSimple('git', ['diff', '--quiet', 'HEAD']);
} catch {
	logError('working tree is not clean — commit or stash changes first');
	process.exit(1);
}

// Update changelog.
info(`updating ${changelog.value}...`);
// TODO: Implement changelog generation logic here.

// Create git tag.
info(`creating tag ${tag}...`);
execSimple('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);

// Push tag.
info(`pushing tag ${tag}...`);
await exec('git', ['push', 'origin', tag]);

success(`released ${tag}`);
