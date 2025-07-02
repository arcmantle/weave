#!/usr/bin/env node

import { execSync } from 'child_process';
import { log } from 'console';
import fs from 'fs';


interface PackageConfig {
	packagePath: string;
	targetRepo:  string;
}

interface Config {
	packages: PackageConfig[];
}


// Set default values for local testing
const GITHUB_EVENT_BEFORE = process.env.GITHUB_EVENT_BEFORE || '';
const GITHUB_SHA = process.env.GITHUB_SHA || 'HEAD';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '';


log({ GITHUB_EVENT_BEFORE, GITHUB_SHA, GITHUB_OUTPUT });


const executeGitCommand = (command: string): string => {
	try {
		return execSync(command, {
			encoding: 'utf8',
			stdio:    [ 'pipe', 'pipe', 'pipe' ],
		}).trim();
	}
	catch (error) {
		return '';
	}
};

const gitObjectExists = (ref: string): boolean => {
	try {
		execSync(`git cat-file -e ${ ref }`, {
			stdio: [ 'pipe', 'pipe', 'pipe' ],
		});

		return true; // If no error thrown, object exists
	}
	catch (error) {
		return false; // Error thrown means object doesn't exist
	}
};

const writeToGitHubOutput = (key: string, value: string): void => {
	if (GITHUB_OUTPUT && GITHUB_OUTPUT !== '/dev/stdout')
		fs.appendFileSync(GITHUB_OUTPUT, `${ key }=${ value }\n`);
};

// Determine comparison range
let compareBase = '';

if (GITHUB_EVENT_BEFORE && GITHUB_EVENT_BEFORE !== '0000000000000000000000000000000000000000') {
	// Check if the before commit exists (handles force pushes)
	if (gitObjectExists(GITHUB_EVENT_BEFORE)) {
		compareBase = GITHUB_EVENT_BEFORE;
		log(`🔍 Comparing ${ GITHUB_EVENT_BEFORE } → ${ GITHUB_SHA }`);
	}
	else {
		log('⚠️ Before commit not found, falling back to HEAD~1');
		compareBase = 'HEAD~1';
	}
}

// Get changed files
let changedFiles: string[] = [];

if (compareBase) {
	const gitOutput = executeGitCommand(`git diff --name-only ${ compareBase } ${ GITHUB_SHA }`);
	changedFiles = gitOutput ? gitOutput.split('\n').filter(file => file.trim()) : [];
}


log('Changed files:');
if (changedFiles.length > 0)
	changedFiles.forEach(file => console.log(file));
else
	log('No changed files detected');


// Validate config file exists and is valid JSON
const configFile = '.github/subtree-sync.json';

if (!fs.existsSync(configFile)) {
	log(`❌ Config file ${ configFile } not found`);
	process.exit(1);
}

let packagesConfig: Config;
try {
	const configContent = fs.readFileSync(configFile, 'utf8');
	packagesConfig = JSON.parse(configContent) as Config;
	log('✅ JSON config file is valid');
}
catch (error) {
	log(`❌ Invalid JSON in ${ configFile }`);
	log(`JSON parsing error: ${ error instanceof Error ? error.message : 'Unknown error' }`);
	process.exit(1);
}

// Process each package
const changedPackages: PackageConfig[] = [];

for (const pkg of packagesConfig.packages || []) {
	const { packagePath, targetRepo } = pkg;

	if (!packagePath || !targetRepo) {
		log(`⚠️ Skipping invalid package entry: ${ JSON.stringify(pkg) }`);
		continue;
	}

	// Check if any changed files start with the package path
	const hasChanges = changedFiles.some(file => file.startsWith(packagePath + '/'));

	if (hasChanges) {
		changedPackages.push(pkg);
		log(`📦 Detected changes in: ${ targetRepo } (${ packagePath })`);
	}
}

// Build final matrix and output to GitHub Actions
if (changedPackages.length > 0) {
	const matrixJson = JSON.stringify(changedPackages);
	writeToGitHubOutput('matrix', matrixJson);
	writeToGitHubOutput('has-changes', 'true');

	log(`🚀 Will sync ${ changedPackages.length } package(s)`);
	log(`Matrix: ${ matrixJson }`);
}
else {
	writeToGitHubOutput('matrix', '[]');
	writeToGitHubOutput('has-changes', 'false');

	log('ℹ️ No package changes detected');
}
