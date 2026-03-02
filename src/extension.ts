import * as vscode from 'vscode';
import { DebuggerProxy } from './debugProxy';
import { WebviewManager } from './webview';

export function activate(context: vscode.ExtensionContext) {
	const webviewManager = new WebviewManager(context.extensionUri);
	const debugProxy = new DebuggerProxy();

	// const workspaceFolders = vscode.workspace.workspaceFolders;
	// if (!workspaceFolders) return;
	// const folderName = '.YTP'; 
	// const folderUri = vscode.Uri.joinPath(workspaceFolders[0].uri, folderName);
	// const debugFileUri = vscode.Uri.joinPath(folderUri, 'debug_log.txt');

	debugProxy.onDidStop(async (variables) => {
		webviewManager.show(variables);
		// try{
		// 	const debugContent = new TextEncoder().encode(JSON.stringify(variables, null, 2));
        // 	await vscode.workspace.fs.writeFile(debugFileUri, debugContent);
		// }
		// catch (e) {
		// 	console.error("Failed to write log:", e);
		// }
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
