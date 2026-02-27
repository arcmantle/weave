import { command, info, success, exec } from '#helpers';

const cmd = command('__NAME__', 'Build and deploy via docker-compose');
const buildFlag = cmd.flag('build', 'Rebuild images before deploying');
const file = cmd.option('file', 'Docker compose file', '__VAR_COMPOSE_FILE__');
const project = cmd.option('project', 'Project name', '__VAR_PROJECT_NAME__');
cmd.parse();

const baseArgs = ['-f', file.value, '-p', project.value];

if (buildFlag.value) {
	info('building images...');
	await exec('docker', [...baseArgs, 'compose', 'build']);
}

info('deploying...');
await exec('docker', [...baseArgs, 'compose', 'up', '-d']);
success('deployed successfully');
