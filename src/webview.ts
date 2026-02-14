import * as vscode from 'vscode';

// Define types locally to match debugProxy behavior
interface VariableData {
	name: string;
	value: string;
	type?: string;
	variablesReference?: number;
    children?: VariableData[];
}

interface DebugContext {
	frameId?: number;
	scopes: {
		scopeName: string;
		variables: VariableData[];
	}[];
}

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
			await this.createWebviewPanel();
		}

		this.webviewPanel!.reveal(vscode.ViewColumn.Beside);

		// Send data via message protocol instead of replacing HTML
		const cleanScopes = context.scopes
			? context.scopes.filter(s => !!s).map(s => ({
				name: s.scopeName,
				variables: s.variables
			}))
			: [];

		this.webviewPanel!.webview.postMessage({
			command: 'updateVariables',
			// Pass relevant data from DebugContext
			scopes: cleanScopes,
			// Pass current watch state if needed, though frontend manages visualizers
			watchedVariables: Array.from(this.watchedVariables) 
		});
		
	}

	private async createWebviewPanel(): Promise<void> {
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

		// Initialize HTML content BEFORE showing the panel
		this.webviewPanel.webview.html = await this.getWebviewHtml();

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

		// Inject CSP and URIs - use regex global flag because {{cspSource}} appears twice in CSP
		htmlContent = htmlContent.replace(/\{\{cspSource\}\}/g, this.webviewPanel!.webview.cspSource);
		htmlContent = htmlContent.replace(/\{\{styleUri\}\}/g, styleUri.toString());
		htmlContent = htmlContent.replace(/\{\{scriptUri\}\}/g, scriptUri.toString());

		return htmlContent;
	}


	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.webviewPanel?.dispose();
	}
}
