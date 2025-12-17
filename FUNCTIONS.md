# YTP Debugger - Function Documentation

This document explains all the functions in the YTP Debugger extension.

## Overview

The extension intercepts Debug Adapter Protocol (DAP) messages to fetch and print variables when debugging C++ programs. It consists of two main files:

- `extension.ts` - Extension entry point
- `debugProxy.ts` - Core debugging logic

---

## extension.ts

### `activate(context: vscode.ExtensionContext)`

**Purpose**: Called by VS Code when the extension is activated (when debugging starts).

**What it does**:
1. Creates an output channel named "YTP Debug Variables" for displaying variable information
2. Instantiates the `DebuggerProxy` class to track debug sessions
3. Registers the `ytp.printDebugVariables` command for manual variable printing
4. Adds all disposables to the context for proper cleanup

**Parameters**:
- `context` - The extension context provided by VS Code, used for registering disposables

---

### `deactivate()`

**Purpose**: Called when the extension is deactivated.

**What it does**:
- Logs that the extension is deactivating
- Cleanup is handled automatically by VS Code using the disposables registered in `activate()`

---

## debugProxy.ts

### Interfaces

#### `StackFrame`
Represents a stack frame from the DAP protocol.

**Fields**:
- `id` - Unique identifier for the frame
- `name` - Function/method name
- `source` - Source file information (path and name)
- `line` - Line number in source file
- `column` - Column number in source file

#### `Scope`
Represents a variable scope (local, global, etc.).

**Fields**:
- `name` - Name of the scope (e.g., "Locals", "Globals")
- `variablesReference` - Reference ID to fetch variables in this scope
- `expensive` - Whether fetching these variables is expensive

#### `Variable`
Represents a single variable.

**Fields**:
- `name` - Variable name
- `value` - String representation of the value
- `type` - Data type (optional)
- `variablesReference` - Reference ID for nested variables (>0 if variable has children)

---

### Class: DebuggerProxy

Main class that manages debug sessions and variable fetching.

---

#### `constructor(outputChannel: vscode.OutputChannel)`

**Purpose**: Initialize the debugger proxy and set up event listeners.

**What it does**:
1. Stores the output channel reference
2. Registers listeners for debug session lifecycle events:
   - `onDidStartDebugSession` - Triggered when debugging starts
   - `onDidTerminateDebugSession` - Triggered when debugging ends
   - `onDidChangeActiveDebugSession` - Triggered when active session changes
3. Registers a `DebugAdapterTrackerFactory` to intercept DAP messages from ANY debugger (using `'*'` pattern)

**Parameters**:
- `outputChannel` - VS Code output channel for printing variable information

---

#### `onDebugSessionStarted(session: vscode.DebugSession)`

**Purpose**: Handle debug session start event.

**What it does**:
1. Prints session information (name and type) to output channel
2. Sets this session as the active session

**Parameters**:
- `session` - The debug session that just started

---

#### `onDebugSessionTerminated(session: vscode.DebugSession)`

**Purpose**: Handle debug session termination.

**What it does**:
1. Prints termination message to output channel
2. Clears active session and frame ID if this was the active session

**Parameters**:
- `session` - The debug session that terminated

---

#### `onActiveDebugSessionChanged(session: vscode.DebugSession | undefined)`

**Purpose**: Handle active debug session changes.

**What it does**:
1. Updates the active session reference
2. Prints information about the new active session

**Parameters**:
- `session` - The new active debug session (or undefined if none)

---

#### `createTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker`

**Purpose**: Create a debug adapter tracker to intercept DAP messages.

**What it does**:
1. Returns a tracker object with `onDidSendMessage` callback
2. This callback is invoked for EVERY message the debug adapter sends
3. Filters for "stopped" events (when debugger hits breakpoint or steps)
4. Automatically fetches and prints variables when stopped

**Parameters**:
- `session` - The debug session to track

**Returns**: A debug adapter tracker object

**How it works**:
- The DAP protocol sends an event with `type: 'event'` and `event: 'stopped'` when execution pauses
- The message body contains `threadId` and `reason` (e.g., "breakpoint", "step")
- When detected, it triggers `fetchAndPrintVariables()`

---

#### `fetchAndPrintVariables(session: vscode.DebugSession, threadId: number)`

**Purpose**: Main function to fetch stack trace, scopes, and variables.

**What it does**:
1. **Step 1**: Sends `stackTrace` DAP request to get the current call stack
   - Parameters: `threadId`, `startFrame: 0`, `levels: 1` (only top frame)
   - Extracts the top stack frame containing current location
2. **Step 2**: Sends `scopes` DAP request to get variable scopes for that frame
   - Parameters: `frameId` from the stack frame
   - Returns array of scopes (Locals, Globals, etc.)
3. **Step 3**: For each scope, calls `printScopeVariables()` to fetch and print variables

**Parameters**:
- `session` - The debug session
- `threadId` - The thread ID where execution stopped

**Error Handling**: Catches and logs any errors during the process

---

#### `printScopeVariables(session: vscode.DebugSession, scope: Scope)`

**Purpose**: Fetch and print all variables in a specific scope.

**What it does**:
1. Prints the scope name as a header
2. Sends `variables` DAP request with the scope's `variablesReference`
3. Iterates through returned variables and calls `printVariable()` for each

**Parameters**:
- `session` - The debug session
- `scope` - The scope object containing the `variablesReference`

---

#### `printVariable(session: vscode.DebugSession, variable: Variable, indent: number)`

**Purpose**: Recursively print a variable and its children (for complex types).

**What it does**:
1. Formats and prints the variable information:
   - Variable name
   - Type (if available)
   - Value
2. **Recursion**: If `variablesReference > 0`, the variable has children (e.g., array elements, struct members)
   - Sends another `variables` request to fetch children
   - Recursively calls itself for each child
3. **Depth limit**: Stops recursion at depth 3 to prevent infinite loops

**Parameters**:
- `session` - The debug session
- `variable` - The variable to print
- `indent` - Current indentation level (0 = top level)

**Example Output**:
```
  myVector (std::vector<int>)
    [0] (int) = 1
    [1] (int) = 2
    [2] (int) = 3
```

---

#### `printCurrentVariables()`

**Purpose**: Public method to manually print variables (called by command).

**What it does**:
1. Validates that there's an active debug session
2. Validates that the debugger is stopped (has an active frame ID)
3. Fetches scopes for the current frame
4. Prints variables for each scope
5. Shows the output channel to user

**When it's used**:
- When user runs the command "YTP: Print Debug Variables" from command palette
- When user creates a keybinding for the command

**Error Handling**: Shows user-friendly warning messages if debugging is not active

---

#### `dispose()`

**Purpose**: Clean up resources when extension is deactivated.

**What it does**:
1. Disposes all registered event listeners
2. Called automatically by VS Code

---

## DAP Request Flow

When the debugger stops at a breakpoint, this is the sequence:

```
1. DAP Adapter sends: { type: 'event', event: 'stopped', body: { threadId, reason } }
   ↓
2. Extension sends: stackTrace request → receives stack frames
   ↓
3. Extension sends: scopes request (with frameId) → receives scopes array
   ↓
4. For each scope:
   Extension sends: variables request (with variablesReference) → receives variables
   ↓
5. For each variable with children:
   Extension sends: variables request (with variable's variablesReference)
   → receives child variables (recursive)
```

---

## Key DAP Requests Used

### `stackTrace`
- **Purpose**: Get the call stack (list of function calls)
- **Request**: `{ threadId, startFrame?, levels? }`
- **Response**: `{ stackFrames: StackFrame[] }`

### `scopes`
- **Purpose**: Get variable scopes for a stack frame
- **Request**: `{ frameId }`
- **Response**: `{ scopes: Scope[] }`

### `variables`
- **Purpose**: Get variables in a scope or children of a variable
- **Request**: `{ variablesReference }`
- **Response**: `{ variables: Variable[] }`

---

## Usage

1. Start debugging your C++ program (F5)
2. Set a breakpoint and run until it hits
3. **Automatic**: Variables are printed to "YTP Debug Variables" output channel
4. **Manual**: Run command "YTP: Print Debug Variables" to print variables on demand
