// @ts-nocheck
console.log('[YTP] Manager.js loaded');

class VisualizerManager {
    constructor() {
        this.blocks = new Map(); // path -> BlockEntry
        this.dashboard = document.getElementById('dashboard');
    }

    // @ts-ignore
    hasBlock(path) {
        return this.blocks.has(path);
    }

    // @ts-ignore
    updateAll(varMap) {
        this.blocks.forEach((entry, path) => {
            const variable = varMap.get(path);
            if (variable) {
                entry.variableData = variable;
                entry.visualizer.update(variable);
            }
        });
        
        // Restore State (if fresh load)
        if (typeof currentState !== 'undefined' && currentState.blocks && this.blocks.size === 0 && varMap.size > 0) {
             // @ts-ignore
             currentState.blocks.forEach(b => {
                 const variable = varMap.get(b.path);
                 if(variable && !this.blocks.has(b.path)) {
                     const x = (b.x !== undefined) ? b.x : null;
                     const y = (b.y !== undefined) ? b.y : null;
                     const type = b.type || 'Text';
                     this.createBlockWithPath(b.path, variable, x, y, type);
                 }
             });
        }
    }

    // @ts-ignore
    createBlockWithPath(path, variable, x = null, y = null, type = 'Text') {
        if (!this.dashboard) return;
        if (this.blocks.has(path)) return;

        const empty = this.dashboard.querySelector('.empty-state-canvas');
        if (empty) /** @type {HTMLElement} */(empty).style.display = 'none';

        if (x === null || y === null) {
            const offset = this.blocks.size * 30; 
            // @ts-ignore
            x = 40 + (offset % 300);
            // @ts-ignore
            y = 40 + (offset % 300);
        }

        const block = document.createElement('div');
        block.className = 'block';
        block.dataset.path = path;
        block.style.position = 'absolute';
        block.style.left = `${x}px`;
        block.style.top = `${y}px`;
        block.style.zIndex = '10';

        // Header
        const header = document.createElement('div');
        header.className = 'block-header';
        
        // Select
        const typeSelect = document.createElement('select');
        typeSelect.className = 'viz-type-select';
        typeSelect.style.marginRight = '8px';
        typeSelect.style.pointerEvents = 'auto'; 
        typeSelect.onmousedown = (e) => e.stopPropagation(); 
        
        if (typeof visualizerRegistry !== 'undefined') {
            visualizerRegistry.getAllTypes().forEach(t => {
                const option = document.createElement('option');
                option.value = t;
                option.textContent = t;
                if (t === type) option.selected = true;
                typeSelect.appendChild(option);
            });
        }

        typeSelect.onchange = (e) => {
            // @ts-ignore
            this.switchVisualizer(path, e.target.value);
        };

        const title = document.createElement('span');
        title.className = 'block-title';
        title.textContent = variable.name;
        title.style.flex = '1';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'block-btn';
        closeBtn.textContent = '✕';
        closeBtn.onmousedown = (e) => e.stopPropagation();
        closeBtn.onclick = () => {
            const checkbox = document.querySelector(`.var-checkbox[data-path="${path}"]`);
            if (checkbox) /** @type {HTMLInputElement} */(checkbox).checked = false;
            this.removeBlock(path);
            // @ts-ignore
            if (window.controller) window.controller.saveState();
        };

        // Header Drag Logic
        header.onmousedown = (e) => {
            if (e.target === typeSelect || e.target === closeBtn) return;
            
            e.preventDefault();
            this.blocks.forEach(b => b.element.style.zIndex = '10');
            block.style.zIndex = '100';

            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = parseFloat(block.style.left) || 0;
            const startTop = parseFloat(block.style.top) || 0;

            // @ts-ignore
            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                block.style.left = `${startLeft + dx}px`;
                block.style.top = `${startTop + dy}px`;
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // @ts-ignore
                if (window.controller) window.controller.saveState();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        header.appendChild(typeSelect);
        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.className = 'block-content';
        
        block.appendChild(header);
        block.appendChild(content);
        this.dashboard.appendChild(block);

        let safeType = type;
        if (typeof visualizerRegistry !== 'undefined') {
             if (!visualizerRegistry.registry.has(type)) safeType = 'Text';
             const visualizer = visualizerRegistry.create(safeType, content);
             visualizer.update(variable);
             
             // Auto-size block to fit content
             this.autoSizeBlock(block, content);
             
             this.blocks.set(path, { 
                element: block, 
                visualizer: visualizer, 
                contentElement: content,
                variableData: variable,
                type: safeType 
            });
        }
    }

    autoSizeBlock(block, content) {
        // Temporarily remove constraints to measure natural size
        const tempWidth = block.style.width;
        const tempHeight = block.style.height;
        block.style.width = 'auto';
        block.style.height = 'auto';
        
        // Force layout recalculation
        block.style.display = 'inline-flex';
        
        // Measure content
        const contentWidth = content.scrollWidth + 20; // Add padding
        const contentHeight = content.scrollHeight + 50; // Add padding + header
        
        // Restore display
        block.style.display = 'flex';
        
        // Apply size with constraints
        const width = Math.min(Math.max(contentWidth, 150), 600);
        const height = Math.min(Math.max(contentHeight, 80), 500);
        
        block.style.width = `${width}px`;
        block.style.height = `${height}px`;
    }

    // @ts-ignore
    switchVisualizer(path, newType) {
        const entry = this.blocks.get(path);
        if (!entry) return;

        if (entry.visualizer.dispose) entry.visualizer.dispose();
        entry.contentElement.innerHTML = '';
        
        if (typeof visualizerRegistry !== 'undefined') {
            const newViz = visualizerRegistry.create(newType, entry.contentElement);
            newViz.update(entry.variableData);
            entry.visualizer = newViz;
            entry.type = newType;
            
            // Auto-resize after switching visualizer
            this.autoSizeBlock(entry.element, entry.contentElement);
        }

        // @ts-ignore
        if (window.controller) window.controller.saveState();
    }

    // @ts-ignore
    removeBlock(path) {
        const entry = this.blocks.get(path);
        if (entry) {
            entry.element.remove();
            this.blocks.delete(path);
        }
        if (this.blocks.size === 0 && this.dashboard) {
            const empty = this.dashboard.querySelector('.empty-state-canvas');
            if (empty) /** @type {HTMLElement} */(empty).style.display = 'block';
        }
    }

    getLayout() {
        // @ts-ignore
        const layout = [];
        this.blocks.forEach((entry, path) => {
            layout.push({
                path: path,
                x: parseInt(entry.element.style.left) || 0,
                y: parseInt(entry.element.style.top) || 0,
                type: entry.type || 'Text'
            });
        });
        // @ts-ignore
        return layout;
    }
}
