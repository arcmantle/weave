import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

let monitorInterval: NodeJS.Timeout | undefined;
const attachedProcesses: Map<number, vscode.DebugSession> = new Map();
let currentBackendPid: number | undefined;

export function activate(context: vscode.ExtensionContext): void {
	console.log('Pivot Auto-Attach extension is now active');

	const enableCommand = vscode.commands.registerCommand('pivot-auto-attach.enable', () => {
		startMonitoring();
		vscode.window.showInformationMessage('Pivot Auto-Attach enabled');
	});

	const disableCommand = vscode.commands.registerCommand('pivot-auto-attach.disable', () => {
		stopMonitoring();
		vscode.window.showInformationMessage('Pivot Auto-Attach disabled');
	});

	// Listen for debug session terminations to clean up our tracking
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession(session => {
			for (const [ pid, trackedSession ] of attachedProcesses.entries()) {
				if (trackedSession.id === session.id) {
					console.log(`Debug session for PID ${ pid } terminated`);
					attachedProcesses.delete(pid);
					if (currentBackendPid === pid)
						currentBackendPid = undefined;

					break;
				}
			}
		}),
	);

	context.subscriptions.push(enableCommand, disableCommand);

	// Auto-start monitoring if enabled in settings
	const config = vscode.workspace.getConfiguration('pivotAutoAttach');
	if (config.get<boolean>('enabled', true))
		startMonitoring();
}

export function deactivate(): void {
	stopMonitoring();
}

function startMonitoring() {
	if (monitorInterval)
		return; // Already monitoring


	console.log('Starting process monitoring');
	monitorInterval = setInterval(checkForNewProcesses, 2000); // Check every 2 seconds
}

function stopMonitoring() {
	if (monitorInterval) {
		clearInterval(monitorInterval);
		monitorInterval = undefined;
		attachedProcesses.clear();
		console.log('Stopped process monitoring');
	}
}

async function findDotnetProcesses(processName: string): Promise<{ Id: number; CommandLine: string; }[]> {
	const isWindows = process.platform === 'win32';

	if (isWindows) {
		// Windows: Use PowerShell
		const command = `Get-Process dotnet -ErrorAction SilentlyContinue | ForEach-Object {
            $proc = $_;
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine;
            if ($cmdLine -like "*${ processName }*") {
                [PSCustomObject]@{
                    Id = $proc.Id
                    CommandLine = $cmdLine
                }
            }
        } | ConvertTo-Json`;

		const { stdout } = await execAsync(command, { shell: 'powershell.exe' });

		if (!stdout.trim())
			return [];

		const processes = JSON.parse(stdout);

		return Array.isArray(processes) ? processes : [ processes ];
	}
	else {
		// Linux/macOS: Use ps command
		const { stdout } = await execAsync('ps -eo pid,command');

		const lines = stdout.split('\n');
		const processes: { Id: number; CommandLine: string; }[] = [];

		for (const line of lines) {
			if (line.includes('dotnet') && line.includes(processName)) {
				const match = line.trim().match(/^(\d+)\s+(.+)$/);
				if (match) {
					processes.push({
						Id:          parseInt(match[1], 10),
						CommandLine: match[2],
					});
				}
			}
		}

		return processes;
	}
}

async function checkForNewProcesses() {
	const config = vscode.workspace.getConfiguration('pivotAutoAttach');
	const processName = config.get<string>('processName', 'Server.dll');

	try {
		const processList = await findDotnetProcesses(processName);

		// First, clean up tracked processes that no longer exist
		const pidsToRemove: number[] = [];
		for (const pid of attachedProcesses.keys()) {
			const stillExists = processList.some(p => p.Id === pid);
			if (!stillExists)
				pidsToRemove.push(pid);
		}

		// Remove dead processes
		for (const pid of pidsToRemove) {
			// Don't try to stop the debug session - just clean up our tracking
			// The session will terminate naturally when the process exits
			console.log(`Process ${ pid } no longer exists, removing from tracking`);
			attachedProcesses.delete(pid);
			if (currentBackendPid === pid) {
				console.log(`Clearing current backend PID ${ currentBackendPid }`);
				currentBackendPid = undefined;
			}
		}

		// Then, attach to any new processes
		for (const process of processList) {
			const pid = process.Id;

			if (!attachedProcesses.has(pid)) {
				console.log(`Found new Server.dll process: ${ pid }`);
				await attachDebugger(pid);
			}
		}
	}
	catch (error) {
		// Process not found or error parsing - ignore
		console.log('No Server.dll processes found or error checking:', error);
	}
}

async function attachDebugger(processId: number) {
	const config = vscode.workspace.getConfiguration('pivotAutoAttach');
	const symbolSearchPaths = config.get<string[]>('symbolSearchPaths', []);

	const debugConfig: vscode.DebugConfiguration = {
		name:          `Auto-Attach to Backend (PID: ${ processId })`,
		type:          'coreclr',
		request:       'attach',
		processId:     processId,
		symbolOptions: {
			searchPaths:                 symbolSearchPaths,
			searchMicrosoftSymbolServer: false,
		},
		justMyCode: false,
	};

	try {
		const success = await vscode.debug.startDebugging(undefined, debugConfig);
		if (success) {
			vscode.window.showInformationMessage(`Attached debugger to Backend process ${ processId }`);

			// Track the newly started debug session
			// The activeDebugSession should be our new session since we just started it
			const session = vscode.debug.activeDebugSession;
			if (session) {
				attachedProcesses.set(processId, session);
				currentBackendPid = processId;
				console.log(`Now tracking backend PID ${ processId }`);
			}
		}
	}
	catch (error) {
		console.error(`Failed to attach to process ${ processId }:`, error);
	}
}
