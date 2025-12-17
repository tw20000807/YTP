# DebuggerProxy API Documentation

This document explains the public API of the `DebuggerProxy` class - the interfaces and methods you can use to fetch debug data.

## Overview

`DebuggerProxy` is responsible for **fetching** debug information from the DAP (Debug Adapter Protocol). It returns structured data that you can use in your code.

---

## Public Methods

### `constructor()`

**Signature**: 
```typescript
constructor()
```

**Description**: 
Initializes the debugger proxy and sets up all internal event listeners. Call this once during extension activation.

**Parameters**: None

**Example**:
```typescript
const debugProxy = new DebuggerProxy();
```

---

### `onStopped(callback)`

**Signature**: 
```typescript
public onStopped(callback: (context: DebugContext) => Promise<void>): void
```

**Description**: 
Registers a callback function that will be called **automatically** whenever the debugger stops (hits breakpoint, steps, etc.). This is how you receive debug data in real-time.

**Parameters**:
- `callback` - An async function that receives the `DebugContext` when the debugger stops

**What it does**:
1. Stores your callback function
2. When debugger stops, automatically fetches all variables
3. Calls your callback with the complete debug data
4. Your callback can then process or display the data

**Example**:
```typescript
debugProxy.onStopped(async (context: DebugContext) => {
    console.log('Debugger stopped at:', context.frameName);
    console.log('Variables:', context.scopes);
    // Process the data here
});
```

---

### `getCurrentDebugContext()`

**Signature**: 
```typescript
public async getCurrentDebugContext(): Promise<DebugContext | null>
```

**Description**: 
Manually fetch the current debug context at any time (e.g., when user runs a command).

**Parameters**: None

**Returns**: 
- `DebugContext | null` - The current debug state, or `null` if debugger is not stopped

**When to use**:
- User triggers a command to print variables manually
- You need debug info on-demand, not just when breakpoint hits

**Example**:
```typescript
const context = await debugProxy.getCurrentDebugContext();
if (context) {
    console.log('Current frame:', context.frameName);
} else {
    console.log('Debugger not stopped');
}
```

---

## Return Types (Interfaces)

### `DebugContext`

The main object returned when debugger stops. Contains all information about the current debug state.

**Definition**:
```typescript
export interface DebugContext {
    frameName: string;           // Name of the current function
    filePath?: string;           // Path to the source file
    line?: number;               // Line number where execution stopped
    column?: number;             // Column number where execution stopped
    scopes: ScopeData[];         // Array of variable scopes (locals, globals, etc.)
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `frameName` | `string` | The name of the current function/method where execution is stopped |
| `filePath` | `string \| undefined` | Full path to the source file (e.g., `/path/to/file.cpp`) |
| `line` | `number \| undefined` | Line number in the source file where execution stopped |
| `column` | `number \| undefined` | Column number where execution stopped |
| `scopes` | `ScopeData[]` | Array of variable scopes (typically: Locals, Globals, Statics, etc.) |

**Example**:
```typescript
{
    frameName: "main",
    filePath: "/home/user/two-pointer.cpp",
    line: 42,
    column: 10,
    scopes: [
        {
            name: "Locals",
            variables: [...]
        },
        {
            name: "Globals",
            variables: [...]
        }
    ]
}
```

---

### `ScopeData`

Represents a variable scope (like Locals, Globals, Static variables, etc.).

**Definition**:
```typescript
export interface ScopeData {
    name: string;              // Name of the scope (e.g., "Locals", "Globals")
    variables: VariableData[]; // Array of variables in this scope
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The scope name (e.g., "Locals", "Globals", "Statics") |
| `variables` | `VariableData[]` | Array of all variables in this scope |

**Example**:
```typescript
{
    name: "Locals",
    variables: [
        { name: "arr", type: "int[3]", value: "0x7fff..." },
        { name: "n", type: "int", value: "5" }
    ]
}
```

---

### `VariableData`

Represents a single variable. Can have nested children for complex types.

**Definition**:
```typescript
export interface VariableData {
    name: string;              // Variable name
    type?: string;             // Data type (e.g., "int", "std::vector<int>")
    value: string;             // String representation of the value
    children?: VariableData[]; // Nested variables (for arrays, structs, etc.)
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The variable name |
| `type` | `string \| undefined` | The data type (e.g., "int", "std::vector<int>", "Point") |
| `value` | `string` | String representation of the value |
| `children` | `VariableData[] \| undefined` | Child variables if this is a complex type (array, struct, vector, etc.) |

**Example - Simple Variable**:
```typescript
{
    name: "count",
    type: "int",
    value: "42",
    children: undefined
}
```

**Example - Complex Variable with Children**:
```typescript
{
    name: "arr",
    type: "int[3]",
    value: "0x7ffd...",
    children: [
        { name: "[0]", type: "int", value: "10" },
        { name: "[1]", type: "int", value: "20" },
        { name: "[2]", type: "int", value: "30" }
    ]
}
```

**Example - Nested Structure**:
```typescript
{
    name: "vec",
    type: "std::vector<int>",
    value: "size=3",
    children: [
        { name: "[0]", type: "int", value: "100" },
        { name: "[1]", type: "int", value: "200" },
        {
            name: "capacity",
            type: "size_t",
            value: "4"
        }
    ]
}
```

---

## Usage Examples

### Example 1: Auto-print on Breakpoint

```typescript
import { DebuggerProxy, DebugContext } from './debugProxy';

const debugProxy = new DebuggerProxy();

// Automatically called whenever debugger stops
debugProxy.onStopped(async (context: DebugContext) => {
    console.log(`Stopped at: ${context.frameName}`);
    console.log(`Location: ${context.filePath}:${context.line}`);
    
    context.scopes.forEach(scope => {
        console.log(`Scope: ${scope.name}`);
        scope.variables.forEach(variable => {
            console.log(`  ${variable.name} = ${variable.value}`);
        });
    });
});
```

### Example 2: Manual Command

```typescript
const printCommand = vscode.commands.registerCommand('ytp.printVariables', async () => {
    const context = await debugProxy.getCurrentDebugContext();
    
    if (!context) {
        vscode.window.showWarningMessage('Debugger is not stopped');
        return;
    }
    
    const output = vscode.window.createOutputChannel('Debug Output');
    output.appendLine(`Frame: ${context.frameName}`);
    output.show();
});
```

### Example 3: Process Specific Variables

```typescript
debugProxy.onStopped(async (context: DebugContext) => {
    // Find the "Locals" scope
    const localsScope = context.scopes.find(s => s.name === 'Locals');
    
    if (localsScope) {
        // Find a specific variable
        const myVar = localsScope.variables.find(v => v.name === 'myArray');
        
        if (myVar && myVar.children) {
            // Process array elements
            myVar.children.forEach(element => {
                console.log(`Element: ${element.value}`);
            });
        }
    }
});
```

### Example 4: Recursive Variable Traversal

```typescript
function printAllVariables(variable: VariableData, indent: number = 0) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${variable.name} = ${variable.value}`);
    
    if (variable.children) {
        variable.children.forEach(child => {
            printAllVariables(child, indent + 1);
        });
    }
}

debugProxy.onStopped(async (context: DebugContext) => {
    context.scopes.forEach(scope => {
        console.log(`=== ${scope.name} ===`);
        scope.variables.forEach(variable => {
            printAllVariables(variable);
        });
    });
});
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│  C++ Program Debug Stop Event       │
│  (Breakpoint/Step)                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  DAP Adapter sends "stopped" event  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  DebuggerProxy.onDidSendMessage()   │
│  (intercepts DAP message)           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  DebuggerProxy.fetchDebugContext()  │
│  - stackTrace request               │
│  - scopes request                   │
│  - variables request (recursive)    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Returns DebugContext object        │
│  {frameName, filePath, line,        │
│   column, scopes[...]}              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Calls your onStopped() callback    │
│  or returns from getCurrentDebugContext()
│                                     │
│  YOUR CODE receives the data        │
│  and can print/process it          │
└─────────────────────────────────────┘
```

---

## Key Points

1. **DebuggerProxy only fetches** - It does NOT print to the output channel
2. **Data is structured** - All variables are organized into interfaces with type safety
3. **Nested data** - Variables can have children for complex types (arrays, structs, etc.)
4. **Depth limited** - Recursion stops at depth 3 to prevent infinite loops
5. **Async operations** - All fetch methods are async (return Promises)
6. **Two ways to use it**:
   - **Auto**: Register callback with `onStopped()` - called on every breakpoint
   - **Manual**: Call `getCurrentDebugContext()` - fetch on demand

---

## Comparison: Before vs After Refactor

**Before**: debugProxy printed directly to output channel
```typescript
debugProxy.printCurrentVariables(); // Handled both fetching AND printing
```

**After**: debugProxy only fetches, extension.ts handles printing
```typescript
const context = await debugProxy.getCurrentDebugContext(); // Only fetching
extension.ts calls printDebugContext(context); // Printing happens in extension.ts
```

This separation of concerns makes the code more flexible - you can use the fetched data for:
- Printing to console
- Sending to a webview
- Analyzing in real-time
- Storing in a database
- etc.
