import * as vscode from 'vscode';
import { DebuggerProxy, DebugContext } from './debugProxy';
import { WebviewManager } from './webview';

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
	// Create webview manager to display variables
	const webviewManager = new WebviewManager(context.extensionUri);

	// Create the debugger proxy to fetch debug data
	const debugProxy = new DebuggerProxy();

	// Set up callback - when debugger stops, show in webview
	debugProxy.onStopped(async (debugContext: DebugContext) => {
		// Show variables in webview
		webviewManager.show(debugContext);
	});

	// Register command to manually fetch variables
	const printCommand = vscode.commands.registerCommand('ytp.printDebugVariables', async () => {
		const debugContext = await debugProxy.getCurrentDebugContext();
		if (debugContext) {
			webviewManager.show(debugContext);
		} else {
			vscode.window.showWarningMessage('No debug context available');
		}
	});

	// Track disposables for cleanup
	context.subscriptions.push(
		debugProxy,
		webviewManager,
		printCommand
	);
}

/**
 * Extension deactivation function
 */
export function deactivate() {}
