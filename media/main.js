// @ts-nocheck

// Visualizer types
/**
 * @typedef {Object} VariableData
 * @property {string} name
 * @property {string} value
 * @property {string} [type]
 * @property {VariableData[]} [children]
 */

const vscode = acquireVsCodeApi();

/**
 * State Management
 */
let currentState = vscode.getState() || {
    splitPaneWidth: 200,
    blocks: [] // { path: string, settings: any }[]
};

/**
 * Main Controller
 */
class VisualizerController {
    constructor() {
        this.visualizerManager = new VisualizerManager();
        
        const splitter = document.getElementById('splitter');
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');

        if (sidebar && currentState.splitPaneWidth) {
            sidebar.style.width = `${currentState.splitPaneWidth}px`;
        }
        if (sidebar && currentState.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
        if (splitter && sidebar) {
            this.splitter = new ResizeHandle(
                splitter,
                sidebar,
                this.saveState.bind(this)
            );
        }
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }

        this.varMap = new Map(); // path -> VariableData

        // Restore State
        if (currentState.splitPaneWidth && sidebar) {
            sidebar.style.width = `${currentState.splitPaneWidth}px`;
        }
        
        // Listeners
        window.addEventListener('message', event => this.handleMessage(event));
        
        // Variable Toggle Listener
        const varList = document.getElementById('variable-list');
        if (varList) {
            varList.addEventListener('change', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                if (target && target.classList.contains('var-checkbox')) {
                    const path = target.dataset.path;
                    if (!path) return;

                    if (target.checked) {
                        const variable = this.varMap.get(path);
                        if(variable) {
                            this.visualizerManager.createBlockWithPath(path, variable);
                        }
                    } else {
                        this.visualizerManager.removeBlock(path);
                    }
                    this.saveState(); 
                    
                    // Notify Extension
                    vscode.postMessage({
                        command: 'toggleVariable', 
                        name: path, 
                        checked: target.checked
                    });
                }
            });
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            this.saveState();
        }
    }

    handleMessage(event) {
        const message = event.data;
        switch (message.command) {
            case 'updateVariables':
                // On a fresh panel (vscode.getState() had no blocks), seed from extension-side savedLayout.
                // This bridges the gap when the panel was closed and re-created.
                if (message.savedLayout && message.savedLayout.length > 0) {
                    if (!currentState.blocks || currentState.blocks.length === 0) {
                        currentState.blocks = message.savedLayout;
                    }
                }
                this.populateVarMap(message.scopes);
                this.renderVariableList(message.scopes);
                this.visualizerManager.updateAll(this.varMap);
                break;
        }
    }

    populateVarMap(scopes) {
        this.varMap.clear();
        
        const traverse = (variables, parentPath) => {
            variables.forEach(v => {
                const path = parentPath ? `${parentPath}.${v.name}` : v.name;
                this.varMap.set(path, v);
                if (v.children && v.children.length > 0) {
                    traverse(v.children, path);
                }
            });
        };

        if (scopes && scopes.length) {
            scopes.forEach(scope => {
                traverse(scope.variables, '');
            });
        }
    }

    renderVariableList(scopes) {
        const list = document.getElementById('variable-list');
        if (!list) return;
        
        // 1. Capture expansion state before clearing
        const expandedPaths = new Set();
        const openDetails = list.querySelectorAll('details[open]');
        openDetails.forEach(details => {
            const checkbox = details.querySelector('.var-checkbox');
            if (checkbox && checkbox.dataset.path) {
                expandedPaths.add(checkbox.dataset.path);
            }
        });

        list.innerHTML = '';

        const renderLevel = (container, variables, parentPath) => {
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.paddingLeft = '20px';

            variables.forEach(v => {
                const path = parentPath ? `${parentPath}.${v.name}` : v.name;
                const li = document.createElement('li');
                
                // Header - Only Checkbox and Name
                const header = document.createElement('div');
                header.className = 'var-header';
                header.style.display = 'flex';
                header.style.alignItems = 'center';

                // Arrow Indicator
                const arrow = document.createElement('span');
                arrow.style.display = 'inline-block';
                arrow.style.width = '20px';
                arrow.style.textAlign = 'center';
                arrow.style.cursor = 'pointer';
                arrow.style.userSelect = 'none';
                arrow.textContent = (v.children && v.children.length > 0) ? '▸' : '';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'var-checkbox';
                checkbox.dataset.path = path;
                if (this.visualizerManager.hasBlock(path)) {
                    checkbox.checked = true;
                }

                const name = document.createElement('span');
                name.className = 'var-name';
                name.textContent = v.name;
                name.style.marginLeft = '5px';
                name.style.cursor = 'default';

                header.appendChild(arrow);
                header.appendChild(checkbox);
                header.appendChild(name);

                // Children (Lazy Loading)
                if (v.children && v.children.length > 0) {
                    const details = document.createElement('details');
                    const summary = document.createElement('summary');
                    summary.style.listStyle = 'none'; 
                    summary.style.cursor = 'pointer';
                    
                    // Hide default triangle for WebKit
                    summary.style.listStyleType = 'none';
                    
                    summary.appendChild(header);
                    
                    details.appendChild(summary);
                    
                    // Lazy load + Arrow update listener
                    const onToggle = () => {
                        arrow.textContent = details.open ? '▾' : '▸';
                        
                        if (details.open && !details.dataset.loaded) {
                            renderLevel(details, v.children, path);
                            details.dataset.loaded = 'true';
                        }
                    };
                    details.addEventListener('toggle', onToggle);

                    // 2. Restore expansion state
                    if (expandedPaths.has(path)) {
                        details.open = true;
                        details.dataset.loaded = 'true';
                        arrow.textContent = '▾';
                        // Immediately render children to persist deep nesting
                        renderLevel(details, v.children, path);
                    }

                    li.appendChild(details);
                } else {
                    // Align leaf nodes with invisible spacer
                    if (!v.children || v.children.length === 0) {
                        arrow.style.visibility = 'hidden';
                        arrow.textContent = '▸'; // Occupy space
                    }
                    li.appendChild(header);
                }

                ul.appendChild(li);
            });
            container.appendChild(ul);
        };

        if (scopes && scopes.length) {
            scopes.forEach(scope => {
                if(scope.variables.length > 0) {
                   const scopeHeader = document.createElement('div');
                   scopeHeader.textContent = scope.name;
                   scopeHeader.style.fontWeight = 'bold';
                   scopeHeader.style.padding = '5px 10px';
                   scopeHeader.style.backgroundColor = '#252526';
                   list.appendChild(scopeHeader);
                   
                   renderLevel(list, scope.variables, '');
                }
            });
        }
    }

    saveState() {
        const sidebar = document.getElementById('sidebar');
        const sidebarWidth = sidebar ? parseInt(sidebar.style.width) || 200 : 200;
        const isCollapsed = sidebar ? sidebar.classList.contains('collapsed') : false;

        const blocks = this.visualizerManager.getLayout();
        const state = {
            splitPaneWidth: sidebarWidth,
            sidebarCollapsed: isCollapsed, 
            blocks: blocks
        };
        vscode.setState(state);
        vscode.postMessage({ command: 'saveLayout', state: state });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.controller = new VisualizerController();
    });
} else {
    window.controller = new VisualizerController();
}
