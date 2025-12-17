import * as vscode from 'vscode';

/**
 * Interface for DAP Stack Frame
 */
interface StackFrame {
	id: number;
	name: string;
	source?: { name: string; path: string };
	line: number;
	column: number;
}

/**
 * Interface for DAP Scope
 */
interface Scope {
	name: string;
	variablesReference: number;
	expensive: boolean;
}

/**
 * Interface for DAP Variable
 */
interface Variable {
	name: string;
	value: string;
	type?: string;
	variablesReference: number;
}

/**
 * Exported interface for variable data returned to caller
 */
export interface VariableData {
	name: string;
	type?: string;
	value: string;
	children?: VariableData[];
}

/**
 * Exported interface for scope data returned to caller
 */
export interface ScopeData {
	name: string;
	variables: VariableData[];
}

/**
 * Exported interface for debug context returned to caller
 */
export interface DebugContext {
	frameName: string;
	filePath?: string;
	line?: number;
	column?: number;
	scopes: ScopeData[];
}

/**
 * DebuggerProxy class
 * Manages debug sessions and fetches variable data when debugger stops
 * Does NOT print - only returns data to caller
 */
export class DebuggerProxy implements vscode.Disposable {
	private activeSession: vscode.DebugSession | undefined;
	private activeFrameId: number | undefined;
	private disposables: vscode.Disposable[] = [];
	
	// Callback to notify when debugger stops
	private onStoppedCallback: ((context: DebugContext) => Promise<void>) | undefined;

	constructor() {
		// Listen for debug session start
		this.disposables.push(
			vscode.debug.onDidStartDebugSession(this.onDebugSessionStarted.bind(this))
		);

		// Listen for debug session termination
		this.disposables.push(
			vscode.debug.onDidTerminateDebugSession(this.onDebugSessionTerminated.bind(this))
		);

		// Listen for active debug session changes
		this.disposables.push(
			vscode.debug.onDidChangeActiveDebugSession(this.onActiveDebugSessionChanged.bind(this))
		);

		// Register debug adapter tracker factory to intercept DAP messages
		this.disposables.push(
			vscode.debug.registerDebugAdapterTrackerFactory('*', {
				createDebugAdapterTracker: (session: vscode.DebugSession) => {
					return this.createTracker(session);
				}
			})
		);
	}

	/**
	 * Register a callback to be called when debugger stops
	 * This is how extension.ts will receive the debug data
	 */
	public onStopped(callback: (context: DebugContext) => Promise<void>): void {
		this.onStoppedCallback = callback;
	}

	/**
	 * Called when a debug session starts
	 */
	private onDebugSessionStarted(session: vscode.DebugSession): void {
		this.activeSession = session;
	}

	/**
	 * Called when a debug session terminates
	 */
	private onDebugSessionTerminated(session: vscode.DebugSession): void {
		if (this.activeSession === session) {
			this.activeSession = undefined;
			this.activeFrameId = undefined;
		}
	}

	/**
	 * Called when the active debug session changes
	 */
	private onActiveDebugSessionChanged(session: vscode.DebugSession | undefined): void {
		this.activeSession = session;
	}

	/**
	 * Create a debug adapter tracker to intercept DAP messages
	 */
	private createTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker {
		return {
			/**
			 * Called when the debug adapter sends a message
			 * We use this to detect when the debugger stops at a breakpoint
			 */
			onDidSendMessage: async (message: any) => {
				// Check if this is a "stopped" event (debugger hit breakpoint/step)
				if (message.type === 'event' && message.event === 'stopped') {
					// Get the thread ID from the stopped event
					const threadId = message.body.threadId;
					
					// Fetch the debug context and call the callback
					const context = await this.fetchDebugContext(session, threadId);
					if (context && this.onStoppedCallback) {
						await this.onStoppedCallback(context);
					}
				}
			}
		};
	}

	/**
	 * Fetch debug context (frame info + variables) when debugger stops
	 * Returns organized data structure with all variable information
	 */
	private async fetchDebugContext(session: vscode.DebugSession, threadId: number): Promise<DebugContext | null> {
		try {
			// Step 1: Get stack trace to find the current frame
			const stackTraceResponse = await session.customRequest('stackTrace', {
				threadId: threadId,
				startFrame: 0,
				levels: 1 // Only get the top frame
			});

			if (!stackTraceResponse.stackFrames || stackTraceResponse.stackFrames.length === 0) {
				return null;
			}

			const frame: StackFrame = stackTraceResponse.stackFrames[0];
			this.activeFrameId = frame.id;

			// Step 2: Get scopes for this frame
			const scopesResponse = await session.customRequest('scopes', {
				frameId: frame.id
			});

			if (!scopesResponse.scopes || scopesResponse.scopes.length === 0) {
				return null;
			}

			// Step 3: Fetch variables for each scope
			const scopesData: ScopeData[] = [];
			for (const scope of scopesResponse.scopes) {
				const scopeData = await this.fetchScopeData(session, scope);
				scopesData.push(scopeData);
			}

			// Build and return the debug context
			const context: DebugContext = {
				frameName: frame.name,
				filePath: frame.source?.path || frame.source?.name,
				line: frame.line,
				column: frame.column,
				scopes: scopesData
			};

			return context;

		} catch (error) {
			console.error(`Error fetching debug context: ${error}`);
			return null;
		}
	}

	/**
	 * Fetch all variables for a scope
	 * Returns organized scope data
	 */
	private async fetchScopeData(session: vscode.DebugSession, scope: Scope): Promise<ScopeData> {
		try {
			// Request variables for this scope
			const variablesResponse = await session.customRequest('variables', {
				variablesReference: scope.variablesReference
			});

			const variables: VariableData[] = [];
			if (variablesResponse.variables && variablesResponse.variables.length > 0) {
				// Fetch each variable
				for (const variable of variablesResponse.variables) {
					const varData = await this.fetchVariableData(session, variable, 0);
					variables.push(varData);
				}
			}

			return {
				name: scope.name,
				variables: variables
			};

		} catch (error) {
			console.error(`Error fetching scope data: ${error}`);
			return {
				name: scope.name,
				variables: []
			};
		}
	}

	/**
	 * Fetch variable data recursively (for nested variables)
	 * Returns variable data with children
	 */
	private async fetchVariableData(session: vscode.DebugSession, variable: Variable, depth: number): Promise<VariableData> {
		const varData: VariableData = {
			name: variable.name,
			type: variable.type,
			value: variable.value
		};

		// If variable has children and we haven't reached depth limit, fetch them
		if (variable.variablesReference > 0 && depth < 3) {
			try {
				const childResponse = await session.customRequest('variables', {
					variablesReference: variable.variablesReference
				});

				if (childResponse.variables && childResponse.variables.length > 0) {
					varData.children = [];
					for (const childVar of childResponse.variables) {
						const childData = await this.fetchVariableData(session, childVar, depth + 1);
						varData.children.push(childData);
					}
				}
			} catch (error) {
				console.error(`Error fetching variable children: ${error}`);
			}
		}

		return varData;
	}

	/**
	 * Public method to manually fetch current variables
	 * Returns the debug context for the current frame
	 */
	public async getCurrentDebugContext(): Promise<DebugContext | null> {
		if (!this.activeSession || !this.activeFrameId) {
			return null;
		}

		try {
			// Get scopes for the active frame
			const scopesResponse = await this.activeSession.customRequest('scopes', {
				frameId: this.activeFrameId
			});

			if (!scopesResponse.scopes || scopesResponse.scopes.length === 0) {
				return null;
			}

			// Fetch variables for each scope
			const scopesData: ScopeData[] = [];
			for (const scope of scopesResponse.scopes) {
				const scopeData = await this.fetchScopeData(this.activeSession, scope);
				scopesData.push(scopeData);
			}

			// Get frame info from a stackTrace request
			const stackTraceResponse = await this.activeSession.customRequest('stackTrace', {
				threadId: 1, // Main thread, may need adjustment
				startFrame: 0,
				levels: 1
			});

			const frame = stackTraceResponse.stackFrames?.[0];

			const context: DebugContext = {
				frameName: frame?.name || 'Unknown',
				filePath: frame?.source?.path || frame?.source?.name,
				line: frame?.line,
				column: frame?.column,
				scopes: scopesData
			};

			return context;

		} catch (error) {
			console.error(`Error getting debug context: ${error}`);
			return null;
		}
	}

	/**
	 * Dispose and clean up resources
	 */
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
