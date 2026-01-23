import * as vscode from 'vscode';
import { DebugContext, VariableData } from './debugProxy';

export class WebviewManager implements vscode.Disposable {
	private webviewPanel: vscode.WebviewPanel | undefined;
	private disposables: vscode.Disposable[] = [];
	private watchedVariables: Set<string> = new Set();
	private outputChannel: vscode.OutputChannel;

	constructor(private extensionUri: vscode.Uri) {
		this.outputChannel = vscode.window.createOutputChannel("YTP Debugger Watch");
	}

	public async show(context: DebugContext): Promise<void> {
		if (!this.webviewPanel) {
			this.createWebviewPanel();
		}

		// Ensure HTML is set (only needed once, but safe to check)
		if (!this.webviewPanel!.webview.html) {
			this.webviewPanel!.webview.html = await this.getWebviewHtml();
		}

		this.webviewPanel!.reveal(vscode.ViewColumn.Beside);

		// Send data via message protocol instead of replacing HTML
		this.webviewPanel!.webview.postMessage({
			command: 'updateVariables',
			// Pass relevant data from DebugContext
			scopes: context.scopes,
			// Pass current watch state if needed, though frontend manages visualizers
			watchedVariables: Array.from(this.watchedVariables) 
		});
		
	}

	private createWebviewPanel(): void {
		this.webviewPanel = vscode.window.createWebviewPanel(
			'ytpDebugVariables',
			'Variables',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true, // Scripts needed for checkboxes
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
			}
		);

		// Initialize HTML content immediately
		this.getWebviewHtml().then(html => {
			if (this.webviewPanel) {
				this.webviewPanel.webview.html = html;
			}
		});

		this.webviewPanel.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'toggleVariable':
					if (message.checked) {
						this.watchedVariables.add(message.name);
						this.outputChannel.appendLine(`Started watching: ${message.name}`);
					} else {
						this.watchedVariables.delete(message.name);
						this.outputChannel.appendLine(`Stopped watching: ${message.name}`);
					}
					return;
				case 'saveLayout':
					// Persist layout state to workspace
					vscode.commands.executeCommand('setContext', 'ytp.layoutState', message.state);
					// You might want to use workspaceState Memento if available, 
					// but passing context here is tricky without passing ExtensionContext to WebviewManager.
					// For now, let's just log it or we can add a method to save transparently.
					// Ideally, WebviewManager should have access to ExtensionContext.globalState or workspaceState.
					return;
			}
		}, null, this.disposables);

		this.webviewPanel.onDidDispose(() => {
			this.webviewPanel = undefined;
		}, null, this.disposables);
	}

	private async getWebviewHtml(): Promise<string> {
		const stylePath = vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'); // Use main.css directly
		const scriptPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'); // Use main.js directly
		
		const styleUri = this.webviewPanel!.webview.asWebviewUri(stylePath);
		const scriptUri = this.webviewPanel!.webview.asWebviewUri(scriptPath);
		
		const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.html');
		let htmlContent = '';
		try {
			const fileData = await vscode.workspace.fs.readFile(htmlPath);
			htmlContent = Buffer.from(fileData).toString('utf-8');
		} catch (e) {
			htmlContent = `<!DOCTYPE html><html><body>Error loading html: ${e}</body></html>`;
		}

		// Inject CSP and URIs
		htmlContent = htmlContent.replace('{{cspSource}}', this.webviewPanel!.webview.cspSource);
		htmlContent = htmlContent.replace('{{styleUri}}', styleUri.toString());
		htmlContent = htmlContent.replace('{{scriptUri}}', scriptUri.toString()); // We need to add this tag to webview.html

		return htmlContent;
	}

	// Remove old generateHtml and renderVariable methods as they are no longer used


	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.webviewPanel?.dispose();
	}
}
