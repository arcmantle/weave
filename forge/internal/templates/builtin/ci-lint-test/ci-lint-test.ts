import { info, success, error as logError, exec } from '#helpers';

info('running __NAME__');

const lintParts = '__VAR_LINT_COMMAND__'.split(' ');
const testParts = '__VAR_TEST_COMMAND__'.split(' ');

const [lintResult, testResult] = await Promise.allSettled([
	(async () => {
		info('running lint...');
		return exec(lintParts[0], lintParts.slice(1), { tag: 'lint', color: '\x1b[36m' });
	})(),
	(async () => {
		info('running tests...');
		return exec(testParts[0], testParts.slice(1), { tag: 'test', color: '\x1b[35m' });
	})(),
]);

let failed = false;

if (lintResult.status === 'rejected') {
	logError(`lint failed: ${lintResult.reason}`);
	failed = true;
}

if (testResult.status === 'rejected') {
	logError(`tests failed: ${testResult.reason}`);
	failed = true;
}

if (failed) {
	process.exit(1);
}

success('lint and tests passed');
