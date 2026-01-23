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
		// Show webview and update content
		this.webviewPanel!.reveal(vscode.ViewColumn.Beside);
		this.webviewPanel!.webview.html = await this.generateHtml(context);
		
		this.checkAndLogVariables(context);
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
			}
		}, null, this.disposables);

		this.webviewPanel.onDidDispose(() => {
			this.webviewPanel = undefined;
		}, null, this.disposables);
	}

	private async generateHtml(context: DebugContext): Promise<string> {
		// Use the flat list of variables directly
		const variables:VariableData[] = [];
		for (const scopes of context.scopes){
			if(scopes.name !== 'Locals' && scopes.name !== 'Globals'){
				continue;
			}
			for (const variable of scopes.variables){
				variables.push(variable);
			}
		}

		const variablesHtml = `<ul>${variables.map((v: VariableData) => this.renderVariable(v)).join('')}</ul>`;

		const stylePath = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.css');
		const styleUri = this.webviewPanel!.webview.asWebviewUri(stylePath);
		
		const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.html');
		const htmlContent = await vscode.workspace.fs.readFile(htmlPath);
		let html = Buffer.from(htmlContent).toString('utf-8');

		html = html.replace('{{cspSource}}', this.webviewPanel!.webview.cspSource);
		html = html.replace('{{styleUri}}', styleUri.toString());
		html = html.replace('{{variables}}', variablesHtml);

		return html;
	}

	private renderVariable(v: VariableData, parentPath: string = ''): string {
		const fullPath = parentPath ? `${parentPath}.${v.name}` : v.name;
		const isChecked = this.watchedVariables.has(fullPath) ? 'checked' : '';
		
		let classes = 'var-item';
		if (v.changeType === 'modified') {
			classes += ' modified';
		}

		const checkbox = `<input type="checkbox" class="var-checkbox" data-name="${fullPath}" ${isChecked}>`;
		const name = `<span class="var-name" title="${v.type}">${v.name}</span>`;
		const value = `<span class="var-value">${v.value}</span>`;
		const type = v.type ? `<span class="var-type">${v.type}</span>` : '';

		const content = `
			<div class="${classes}">
				${checkbox}
				${name}
				${type}
				${value}
			</div>
		`;

		if (v.children && v.children.length > 0) {
			const childrenHtml = v.children.map(child => this.renderVariable(child, fullPath)).join('');
			return `
				<li>
					<details>
						<summary>${content}</summary>
						<ul>${childrenHtml}</ul>
					</details>
				</li>
			`;
		} else {
			return `<li>${content}</li>`;
		}
	}

	private checkAndLogVariables(context: DebugContext): void {
		if (this.watchedVariables.size === 0) return;

		const logVariable = (v: VariableData, parentPath: string = '') => {
			const fullPath = parentPath ? `${parentPath}.${v.name}` : v.name;
			
			if (this.watchedVariables.has(fullPath)) {
				this.outputChannel.appendLine(`[Watch] ${fullPath}: ${v.value}`);
			}

			if (v.children) {
				v.children.forEach(child => logVariable(child, fullPath));
			}
		};

		for (const scopes of context.scopes) {
			if (scopes.name !== 'Locals' && scopes.name !== 'Globals') continue;
			for (const variable of scopes.variables) {
				logVariable(variable);
			}
		}
	}

	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.webviewPanel?.dispose();
	}
}
