import * as vscode from 'vscode';
import { DebuggerProxy } from './debugProxy';
import { WebviewManager } from './webview';

export function activate(context: vscode.ExtensionContext) {
	const webviewManager = new WebviewManager(context.extensionUri);
	const debugProxy = new DebuggerProxy();
	
	debugProxy.onDidStop(async (variables) => {
		webviewManager.show(variables);
	});
	debugProxy.end(async () => {
		if (webviewManager) {
			webviewManager.hide();
		}
	});
	context.subscriptions.push(
		debugProxy,
		webviewManager
	);
}

export function deactivate() {}
