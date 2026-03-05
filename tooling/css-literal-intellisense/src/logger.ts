import * as vscode from 'vscode';


let outputChannel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
	outputChannel = vscode.window.createOutputChannel('CSS Literal IntelliSense');

	return outputChannel;
}

export function log(message: string): void {
	outputChannel?.appendLine(`[${new Date().toISOString().slice(11, 23)}] ${message}`);
}
