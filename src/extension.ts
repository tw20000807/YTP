import * as vscode from 'vscode';
import { DebuggerProxy } from './debugProxy';
// import { WebviewManager } from './webview';

export function activate(context: vscode.ExtensionContext) {
	// const webviewManager = new WebviewManager(context.extensionUri);
	const debugProxy = new DebuggerProxy();

	debugProxy.onDidStop(async (text) => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
		const folderName = '.YTP'; 
		const folderUri = vscode.Uri.joinPath(workspaceFolders[0].uri, folderName);
		const fileUri = vscode.Uri.joinPath(folderUri, 'debug_log.txt');

		try{
			const content = new TextEncoder().encode(JSON.stringify(text, null, 2));
        	await vscode.workspace.fs.writeFile(fileUri, content);
		}
		catch (e) {
			console.error("Failed to write debug log:", e);
		}
	});
	context.subscriptions.push(
		debugProxy
	);
}

export function deactivate() {}
