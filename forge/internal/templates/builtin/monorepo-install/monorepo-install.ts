import { info, success, warn, findDirsContaining, exec } from '#helpers';

info('running __NAME__');

const pm = '__VAR_PACKAGE_MANAGER__';

const dirs = findDirsContaining('.', 'package.json');
if (dirs.length === 0) {
	warn('no package.json files found');
	process.exit(0);
}

info(`installing dependencies in ${dirs.length} directories...`);

const results = await Promise.allSettled(
	dirs.map(dir =>
		exec(pm, ['install'], { dir })
	)
);

const failed = results.filter(r => r.status === 'rejected');
if (failed.length > 0) {
	warn(`${failed.length} install(s) failed`);
	process.exit(1);
}

success('all installs complete');
