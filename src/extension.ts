import * as vscode from 'vscode';
import { DebuggerProxy, DebugContext } from './debugProxy';

/**
 * Extension activation function
 * Called when the extension is activated (when debugging starts)
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('YTP Debugger extension is now active');

	// Create output channel for printing debug variables
	const outputChannel = vscode.window.createOutputChannel('YTP Debug Variables');
	
	// Create the debugger proxy to fetch debug data
	const debugProxy = new DebuggerProxy();

	// Set up callback - this is where we PRINT the variables
	debugProxy.onStopped(async (debugContext: DebugContext) => {
		printDebugContext(outputChannel, debugContext);
	});

	// Register command to manually fetch and print variables
	const printCommand = vscode.commands.registerCommand('ytp.printDebugVariables', async () => {
		const debugContext = await debugProxy.getCurrentDebugContext();
		if (debugContext) {
			printDebugContext(outputChannel, debugContext);
		} else {
			vscode.window.showWarningMessage('No debug context available');
		}
	});

	// Track disposables for cleanup
	context.subscriptions.push(
		debugProxy,
		printCommand,
		outputChannel
	);
}

/**
 * Helper function to print debug context to output channel
 * This is where the PRINTING logic lives
 */
function printDebugContext(outputChannel: vscode.OutputChannel, context: DebugContext): void {
	outputChannel.appendLine(`\n=== Debugger Stopped ===`);
	outputChannel.appendLine(`Frame: ${context.frameName}`);
	
	if (context.filePath) {
		outputChannel.appendLine(`File: ${context.filePath}`);
	}
	if (context.line !== undefined && context.column !== undefined) {
		outputChannel.appendLine(`Location: Line ${context.line}, Column ${context.column}`);
	}

	// Print each scope and its variables
	for (const scope of context.scopes) {
		outputChannel.appendLine(`\n--- Scope: ${scope.name} ---`);
		
		if (scope.variables.length === 0) {
			outputChannel.appendLine('  (no variables)');
		} else {
			for (const variable of scope.variables) {
				printVariable(outputChannel, variable, 1);
			}
		}
	}

	outputChannel.show();
}

/**
 * Helper function to recursively print a variable
 */
function printVariable(outputChannel: vscode.OutputChannel, variable: any, depth: number): void {
	const indent = '  '.repeat(depth);
	
	let line = `${indent}${variable.name}`;
	if (variable.type) {
		line += ` (${variable.type})`;
	}
	line += ` = ${variable.value}`;
	
	outputChannel.appendLine(line);

	// Print children if they exist
	if (variable.children && variable.children.length > 0) {
		for (const child of variable.children) {
			printVariable(outputChannel, child, depth + 1);
		}
	}
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate() {
	console.log('YTP Debugger extension is now deactivated');
}
