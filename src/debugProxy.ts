import * as vscode from 'vscode';
interface Scope {
	name: string;
	variablesReference: number;
	expensive: boolean;
}
interface Variable {
	name: string;
	value: string;
	type?: string;
	evaluateName?: string;
	memoryReference?: string;
	variablesReference: number;
}
export interface StackFrame {
	id: number;
	name: string;
	source?: { name: string; path: string };
	line: number;
	column: number;
}
export interface StackTraceInfo {
	totalFrames?: number;
	stackFrames: StackFrame[];
}
export class DebuggerProxy implements vscode.Disposable {
	private disposables: vscode.Disposable[] = [];
	public activeSession: vscode.DebugSession | undefined;
	public activeFrameID: number | undefined;
	
	private _onDidDataChanged = new vscode.EventEmitter<any>();
	readonly onDidDataChanged = this._onDidDataChanged.event;
	
	// private _output = new vscode.EventEmitter<any>();
	// readonly output = this._output.event;
	
	private _end = new vscode.EventEmitter<void>();
	readonly end = this._end.event;

	private _onDebuggerStart = new vscode.EventEmitter<void>();
	readonly onDebuggerStart = this._onDebuggerStart.event;

	constructor() {
		this.disposables.push(
			this._onDidDataChanged,
			this._onDebuggerStart,
			vscode.debug.onDidStartDebugSession((s: vscode.DebugSession) => {
				this.activeSession = s;
				this._onDebuggerStart.fire();
			}),
			vscode.debug.onDidTerminateDebugSession((s: vscode.DebugSession) => {
				if(this.activeSession?.id === s.id) {
					this.activeSession = undefined;
					this.activeFrameID = undefined;
				}
				this._end.fire();
			}),
			vscode.debug.onDidChangeActiveDebugSession((s: vscode.DebugSession | undefined) => {this.activeSession = s;}),
			vscode.debug.registerDebugAdapterTrackerFactory("*", {
				createDebugAdapterTracker: (session : vscode.DebugSession) => {
					this.activeSession = session;
					return {
						onDidSendMessage: async (msg : any) => {
							if (msg.type === "event") {
								if (msg.event === "stopped") {
									const threadId = msg.body.threadId;
									const r = await this.getStackTrace({threadId});
									this.activeFrameID = r.stackFrames.length > 0 ? r.stackFrames[0].id : undefined;
									const data = await this.getNowVariable();
									this._onDidDataChanged.fire(data);
								}
							}
						},
					};
				},
			}),
		);
	}
	public async getNowVariable(): Promise<any> {
		try {
			if(!this.activeFrameID) {
				return "No data";
			}
			const scopes = await this.getScopes({ frameId: this.activeFrameID });
			const detailedScopes = await Promise.all(scopes.map(async (scope) => {
				if(scope.name === "Registers") return;
				return {
					scopeName: scope.name,
					variables: await this.RecursivegetVariables({ variablesReference: scope.variablesReference }, 0, new Set<string>())
				};
			}));

			return {
				frameId: this.activeFrameID,
				scopes: detailedScopes
			};
		} 
		catch (e) {
			return {e};
		}
	}
	public async getStackTrace(args: {threadId: number }): Promise<StackTraceInfo> {
		try {
			const reply = (await this.activeSession!.customRequest("stackTrace", {threadId: args.threadId,})) as { totalFrames?: number; stackFrames: StackFrame[] };
			return reply;
		} catch (e) {
			console.error(e);
			throw e;
		}
	}
	public async getScopes(args: { frameId: number }): Promise<Scope[]> {
		try {
			const reply = await this.activeSession!.customRequest("scopes", {frameId: args.frameId,});
			if (!reply) {
				return [];
			}
			return reply.scopes;
		} catch (error) {
			console.error(error);
			return [];
		}
	}
	
	public async RecursivegetVariables(args: { variablesReference: number }, dep: number, seen: Set<string>): Promise<any> {
		// if (args.variablesReference === 0 || dep > 4) return [];
	
		if (args.variablesReference === 0) return [];
		try {
			const arr = await this.getVariables({variablesReference: args.variablesReference});
			return await Promise.all(arr.map(async (v : Variable) => {
				const evalName = v.evaluateName || v.name;
				
				const node: any = {
					name: v.evaluateName ? v.evaluateName : v.name,
					evaluateName: evalName,
					value: v.value,
					type: v.type,
					memoryReference: v.memoryReference
				};
				if(v.value == "0x0") return node; // avoid infinite loop caused by null pointer
				if (seen.has(evalName)) return node;
				seen.add(evalName);
				if (v.variablesReference > 0) {
					node.children = await this.RecursivegetVariables({variablesReference: v.variablesReference}, dep + 1, seen);
				}
				return node;
			}));
		} catch (error) {
			console.error(error);
			return [];
		}
	}
	public async getVariables(args: { variablesReference: number }): Promise<Variable[]> {
		try {
			const reply = await this.activeSession!.customRequest("variables", {
				variablesReference: args.variablesReference,
			});
			if (!reply) {
				return [];
			}
			return reply.variables;
		} catch (error) {
			console.error(error);
			return [];
		}
	}
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
