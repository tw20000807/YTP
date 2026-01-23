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
 * Exported interface for variable data with change tracking
 */
export interface VariableData {
	name: string;
	type?: string;
	value: string;
	children?: VariableData[];
	changeType?: 'new' | 'modified' | 'unchanged'; // Track if variable is new, modified, or unchanged
	previousValue?: string; // Previous value if modified
	variablesReference?: number; // Reference for nested variables (needed for setVariable)
	parent?: VariableData; // Reference to parent variable
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
 * Tracks variable changes (new, modified, unchanged)
 */
export class DebuggerProxy implements vscode.Disposable {
	private activeSession: vscode.DebugSession | undefined;
	private activeFrameId: number | undefined;
	private disposables: vscode.Disposable[] = [];
	private previousContext: DebugContext | null = null; // Store previous context for change detection
	
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
						// Mark changes in variables before calling callback
						this.markVariableChanges(context);
						// Store for next comparison
						this.previousContext = context;
						await this.onStoppedCallback(context);
					}
				}
			}
		};
	}

	/**
	 * Compare current variables with previous context to mark changes
	 */
	private identical(v1 : VariableData, v2: VariableData): boolean {
		if(v1.value !== v2.value) return false;
		const children1 = v1.children || [];
        const children2 = v2.children || [];
		if(children1.length != children2.length) return false;
		for(let i = 0;i < children1.length;i++){
			if(!this.identical(children1[i],children2[i])){
				return false;
			}
		}
		return true
	}
	private markVariableChanges(context: DebugContext): void {
		for (const scope of context.scopes) {
			const previousScope = this.previousContext?.scopes.find(s => s.name === scope.name);
			
			for (const variable of scope.variables) {
				const previousVar = previousScope?.variables.find(v => v.name === variable.name);
				
				if (!previousVar) {
					variable.changeType = 'new';
				} else if (this.identical(previousVar,variable)) {
					variable.changeType = 'modified';
				} else {
					variable.changeType = 'unchanged';
				}
			}
		}
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
	private async fetchVariableData(session: vscode.DebugSession, variable: Variable, depth: number, parent?: VariableData): Promise<VariableData> {
		const varData: VariableData = {
			name: variable.name,
			type: variable.type,
			value: variable.value
		};

		if (parent) {
			Object.defineProperty(varData, 'parent', { value: parent, enumerable: false, writable: true });
		}

		// If variable has children and we haven't reached depth limit, fetch them
		if (variable.variablesReference > 0 && depth < 3) {
			try {
				const childResponse = await session.customRequest('variables', {
					variablesReference: variable.variablesReference
				});

				if (childResponse.variables && childResponse.variables.length > 0) {
					varData.children = [];
					for (const childVar of childResponse.variables) {
						const childData = await this.fetchVariableData(session, childVar, depth + 1, varData);
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
	 * Set a variable value in the debug session
	 * @param variablesReference - The reference to the variable's parent scope
	 * @param name - The variable name
	 * @param value - The new value (as string)
	 * @returns True if successful, false otherwise
	 */
	public async setVariable(
		variablesReference: number,
		name: string,
		value: string
	): Promise<boolean> {
		if (!this.activeSession) {
			console.error('No active debug session');
			return false;
		}

		try {
			const response = await this.activeSession.customRequest('setVariable', {
				variablesReference: variablesReference,
				name: name,
				value: value
			});

			console.log(`Variable set successfully: ${name} = ${value}`);
			return true;
		} catch (error) {
			console.error(`Error setting variable: ${error}`);
			return false;
		}
	}

	/**
	 * Dispose and clean up resources
	 */
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
