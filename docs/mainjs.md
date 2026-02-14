# Media/Main.js Documentation

This document explains the architecture and implementation of the frontend logic for the Visualization View, located in [`media/main.js`](../media/main.js).

## Architecture Overview

The `main.js` script powers the webview interface. It communicates with the extension backend via the VS Code Webview API (`acquireVsCodeApi`). The code involves several key classes:

1.  **VisualizerController**: The main entry point that orchestrates state, message handling, and UI updates.
2.  **VisualizerManager**: Manages the dashboard area where variable visualizations (blocks) are displayed.
3.  **TextVisualizer**: A specific implementation for rendering variable data (currently text-based).
4.  **ResizeHandle**: Handles the drag-to-resize functionality for the sidebar.

---

## Class: VisualizerController

The `VisualizerController` is the central hub of the frontend application. It is initialized when the DOM content is loaded.

### Responsibilities
*   **Initialization**: Sets up event listeners for messages from the extension, drag-and-drop operations, and variable toggling.
*   **State Management**: Loads and saves the webview state (e.g., sidebar width, open blocks) using `vscode.getState()` and `vscode.setState()`.
*   **Message Handling**: Processes `updateVariables` commands from the extension to refresh the data.
*   **Data Mapping**: Maintains a flat map of all variables for quick lookup.

### Key Methods

#### `populateVarMap(scopes)`
This method flattens the hierarchical variable data received from the debug adapter into a `Map` (`this.varMap`).
-   **Input**: An array of scopes (Locals, Globals, etc.), each containing a tree of variables.
-   **Operation**: Recursively traverses the variable tree. It generates a unique `path` for each variable (e.g., `local.myObject.property`) and stores the variable data in the map.
-   **Purpose**: Allows O(1) access to any variable's data using its path, which is critical for updating specific visualization blocks without re-traversing the tree.

#### `renderVariableList(scopes)`
This method dynamically builds the DOM for the sidebar variable list.
-   It iterates through scopes and their variables to create the list items.
-   **Lazy Loading**: It implements a lazy loading strategy for nested variables (see detailed section below).
-   **UI Structure**: Renders a **checkbox** and a **variable name** for each item. The expand/collapse arrow (`▸`/`▾`) indicates nested content.
-   **Interaction**: Toggling the checkbox calls `VisualizerManager` to add or remove a visualization block.

---

## Class: VisualizerManager

This class manages the "Dashboard" area (the right pane) where visualizations appear.

### Responsibilities
*   **Block creation**: Creates the container elements (`.block`) for visualizations, including headers and close buttons.
*   **Layout Management**: Keeps track of active blocks using a `Map` (path -> block).
*   **Updates**: When data changes, it delegates the update task to the specific visualizer instance associated with a block.
*   **Drag & Drop**: Handles reordering of blocks within the dashboard.

---

## Class: TextVisualizer

Currently, this is the default visualizer implementation.

*   **Usage**: Instantiated by `VisualizerManager` when a new block is created.
*   **Function**: It takes the variable data and renders it as a formatted JSON string inside a `<pre>` tag.

---

## Class: ResizeHandle

A utility class that enables the sidebar resizing functionality.

*   **Mechanism**: Attaches `mousedown` listeners to the splitter element.
*   **Layout**: Adjusts the `width` style of the sidebar element based on mouse movement.
*   **Persistence**: Calls `saveState` when resizing finishes.

---

## Lazy Loading and Performance Optimization

To ensure the Debug View remains responsive even when debugging applications with massive data structures, `renderVariableList` implements **Lazy Loading**.

### The Problem
Rendering a deeply nested object (like a complex class or large array) immediately would require creating thousands of DOM elements, causing the UI to freeze("Do not recursive" requirement).

### The Solution
1.  **Initial Render**: Only the top-level variables of each scope are rendered initially.
2.  **Pointer Events**: Variables with children are rendered with a `<details>` and `<summary>` element.
3.  **On-Demand Fetching**:
    *   The `renderLevel` internal helper function is used to render nodes.
    *   When a user expands a variable (toggles the `<details>` element), a 'toggle' event listener triggers.
    *   **Check**: The code checks a `data-loaded` attribute on the element.
    *   **Action**: If not loaded, it calls `renderLevel` for *only* that specific branch of the variable tree.
    *   **Mark**: The element is marked as `data-loaded="true"` so subsequent toggles do not re-render the DOM.

### Code Logic
```javascript
// Inside renderVariableList
const onToggle = () => {
    arrow.textContent = details.open ? '▾' : '▸';
    
    // Lazy Load Check
    if (details.open && !details.dataset.loaded) {
        renderLevel(details, v.children, path); // Render children now
        details.dataset.loaded = 'true';        // Mark as loaded
    }
};
details.addEventListener('toggle', onToggle);
```

This ensures that the DOM size remains proportional to what the user effectively explores, rather than the total size of the debug state.
