// @ts-nocheck
console.log('[YTP] main.js is loading...');

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
    splitPaneWidth: 300,
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
        if (splitter && sidebar) {
            this.splitter = new ResizeHandle(
                splitter,
                sidebar,
                this.saveState.bind(this)
            );
        }

        this.varMap = new Map(); // path -> VariableData

        // Restore State
        if (currentState.splitPaneWidth && sidebar) {
            sidebar.style.width = `${currentState.splitPaneWidth}px`;
        }
        
        // Listeners
        window.addEventListener('message', event => this.handleMessage(event));
        
        // Block reordering listeners
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.addEventListener('dragstart', this.handleDragStart.bind(this));
            dashboard.addEventListener('dragover', this.handleDragOver.bind(this));
            dashboard.addEventListener('drop', this.handleDrop.bind(this));
        }
        
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

    handleMessage(event) {
        const message = event.data;
        switch (message.command) {
            case 'updateVariables':
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

    /* Drag & Drop Reordering Logic */
    handleDragStart(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target && target.classList.contains('block-header')) {
            const block = target.closest('.block');
            if (block) {
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                window.draggedBlock = block;
            }
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        const dragged = window.draggedBlock;
        if (!dragged) return;

        dragged.classList.remove('dragging');
        const targetElement = /** @type {HTMLElement} */ (e.target);
        const target = targetElement.closest('.block');
        
        if (target && target !== dragged) {
            const dashboard = document.getElementById('dashboard');
            if (dashboard) {
                const rect = target.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    dashboard.insertBefore(dragged, target);
                } else {
                    dashboard.insertBefore(dragged, target.nextSibling);
                }
                this.saveState();
            }
        }
        window.draggedBlock = null;
    }

    saveState() {
        const sidebar = document.getElementById('sidebar');
        const sidebarWidth = sidebar ? parseInt(sidebar.style.width) : 300;
        const blocks = this.visualizerManager.getLayout();
        
        const state = {
            splitPaneWidth: sidebarWidth,
            blocks: blocks
        };
        
        vscode.setState(state);
        vscode.postMessage({ command: 'saveLayout', state: state });
    }
}

/**
 * Visualizer Management
 */
class VisualizerManager {
    constructor() {
        this.blocks = new Map(); // path -> BlockElement
        this.dashboard = document.getElementById('dashboard');
    }

    hasBlock(path) {
        return this.blocks.has(path);
    }

    updateAll(varMap) {
        this.blocks.forEach((entry, path) => {
            const variable = varMap.get(path);
            if (variable) {
                entry.visualizer.update(variable);
            }
        });
        
        // Check for state restoration needs
        if (currentState.blocks && this.blocks.size === 0 && varMap.size > 0) {
             currentState.blocks.forEach(b => {
                 const variable = varMap.get(b.path);
                 if(variable && !this.blocks.has(b.path)) {
                     this.createBlockWithPath(b.path, variable);
                 }
             });
        }
    }

    createBlockWithPath(path, variable) {
        if (!this.dashboard) return;
        if (this.blocks.has(path)) return;

        // Remove empty state
        const empty = this.dashboard.querySelector('.empty-state-canvas');
        if (empty) {
            /** @type {HTMLElement} */(empty).style.display = 'none';
        }

        // DOM Creation
        const block = document.createElement('div');
        block.className = 'block';
        block.dataset.path = path;
        block.style.width = '300px'; 
        block.style.height = '200px';
        block.style.resize = 'both';
        block.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.className = 'block-header';
        header.draggable = true;
        
        const title = document.createElement('span');
        title.className = 'block-title';
        title.textContent = variable.name;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'block-btn';
        closeBtn.textContent = '✕';
        closeBtn.onclick = () => {
            const checkbox = document.querySelector(`.var-checkbox[data-path="${path}"]`);
            if (checkbox) {
                /** @type {HTMLInputElement} */(checkbox).checked = false;
            }
            this.removeBlock(path);
            if (window.controller) window.controller.saveState();
        };

        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.className = 'block-content';

        block.appendChild(header);
        block.appendChild(content);

        this.dashboard.appendChild(block);

        const visualizer = new TextVisualizer(content);
        visualizer.update(variable);

        this.blocks.set(path, { element: block, visualizer: visualizer });
    }

    removeBlock(path) {
        const entry = this.blocks.get(path);
        if (entry) {
            entry.element.remove();
            this.blocks.delete(path);
        }
        if (this.blocks.size === 0 && this.dashboard) {
            const empty = this.dashboard.querySelector('.empty-state-canvas');
            if (empty) {
                /** @type {HTMLElement} */(empty).style.display = 'block';
            }
        }
    }

    getLayout() {
        const layout = [];
        this.blocks.forEach((entry, path) => {
            layout.push({
                path: path
            });
        });
        return layout;
    }
}

/**
 * Visualizers
 */
class TextVisualizer {
    constructor(container) {
        this.container = container;
        this.pre = document.createElement('div');
        this.pre.className = 'viz-text';
        this.container.appendChild(this.pre);
    }
    update(variable) {
        this.pre.textContent = variable.value;
        // this.pre.textContent = JSON.stringify(variable, (key, value) => {
        //     if (key === 'parent') return undefined; // Avoid circular
        //     if (key === 'children') return '[Children...]'; // Simplify
        //     return value;
        // }, 2);
    }
}

/**
 * Resizing Logic for Sidebar
 */
class ResizeHandle {
    constructor(handle, target, onEnd) {
        this.handle = handle;
        this.target = target;
        this.onEnd = onEnd;
        this.isResizing = false;

        this.handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            this.startX = e.clientX;
            this.startWidth = parseInt(getComputedStyle(this.target).width, 10);
            
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        });
        
        this.handleMouseMove = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const newWidth = this.startWidth + dx;
            if (newWidth > 150 && newWidth < 600) {
                this.target.style.width = `${newWidth}px`;
            }
        };
        
        this.handleMouseUp = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            this.isResizing = false;
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            if (this.onEnd) this.onEnd();
        };
    }
}

// Initialize with DOM ready check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.controller = new VisualizerController();
    });
} else {
    window.controller = new VisualizerController();
}
