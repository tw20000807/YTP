import * as vscode from 'vscode';
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
	private layoutState: any[] = []; // persisted in-memory across panel close/reopen
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
			scopes: cleanScopes,
			watchedVariables: Array.from(this.watchedVariables),
			// Send persisted layout so the webview can restore blocks after a panel close
			savedLayout: this.layoutState
		});
		
	}
	public async hide() : Promise<void> {
		this.webviewPanel?.dispose();
		this.webviewPanel = undefined;
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
					// Keep layout in memory so it survives panel disposal and can be
					// sent back as savedLayout on the next updateVariables message.
					this.layoutState = (message.state && message.state.blocks) ? message.state.blocks : [];
					return;
			}
		}, null, this.disposables);


		this.webviewPanel.onDidDispose(() => {
			this.webviewPanel = undefined;
		}, null, this.disposables);
	}
	private async getWebviewHtml(): Promise<string> {
		const stylePath = vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'); // Use main.css directly
		
		const styleUri = this.webviewPanel!.webview.asWebviewUri(stylePath);
		
        // Auto-load all lib scripts from media/lib/ (e.g. d3-force.min.js) before visualizers
        const libDir = vscode.Uri.joinPath(this.extensionUri, 'media', 'lib');
        let libPaths: string[][] = [];
        try {
            const libFiles = await vscode.workspace.fs.readDirectory(libDir);
            libPaths = libFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.js'))
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name]) => ['media', 'lib', name]);
        } catch (_) { /* lib/ folder may not exist */ }

        // Auto-discover all visualizer scripts from media/visualizers/
        // BaseVisualizer.js must load first so subclasses can extend it
        const visualizersDir = vscode.Uri.joinPath(this.extensionUri, 'media', 'visualizers');
        const visualizerFiles = await vscode.workspace.fs.readDirectory(visualizersDir);
        const visualizerPaths: string[][] = [
            ['media', 'visualizers', 'BaseVisualizer.js'], // always first
            ...visualizerFiles
                .filter(([name, type]) =>
                    type === vscode.FileType.File &&
                    name.endsWith('.js') &&
                    name !== 'BaseVisualizer.js'
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name]) => ['media', 'visualizers', name])
        ];

        const scriptPaths = [
            ['media', 'core', 'Registry.js'],
            ...libPaths,
            ...visualizerPaths,
            ['media', 'utils', 'ResizeHandle.js'],
            ['media', 'core', 'Manager.js'],
            ['media', 'main.js']
        ];

        const scriptTags = scriptPaths.map(pathSegments => {
            const uri = this.webviewPanel!.webview.asWebviewUri(
                vscode.Uri.joinPath(this.extensionUri, ...pathSegments)
            );
            return `<script src="${uri.toString()}"></script>`;
        }).join('\n\t\t');
		
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
		htmlContent = htmlContent.replace(/\{\{scripts\}\}/g, scriptTags);



		return htmlContent;
	}
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.webviewPanel?.dispose();
	}
}
