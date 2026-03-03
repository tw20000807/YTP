// @ts-nocheck
console.log('[YTP] Manager.js loaded');

class VisualizerManager {
    constructor() {
        this.blocks          = new Map(); // path -> BlockEntry (currently visible)
        this.knownBlocks     = new Map(); // path -> {x,y,type,w,h,params} (persists across uncheck)
        this.dashboard       = document.getElementById('dashboard');
        this.activePopupPath = null;     // only one popup open at a time
    }

    // @ts-ignore
    hasBlock(path) {
        return this.blocks.has(path);
    }

    // @ts-ignore
    updateAll(varMap) {
        // 1. Populate knownBlocks from saved state (first call after load)
        if (typeof currentState !== 'undefined' && currentState.blocks && currentState.blocks.length > 0) {
            currentState.blocks.forEach(b => {
                if (!this.knownBlocks.has(b.path)) {
                    this.knownBlocks.set(b.path, {
                        x: b.x !== undefined ? b.x : null,
                        y: b.y !== undefined ? b.y : null,
                        type:   b.type   || 'Text',
                        w:      b.w      || null,
                        h:      b.h      || null,
                        params: b.params || {}
                    });
                }
            });
        }

        // 2. Update currently visible blocks
        this.blocks.forEach((entry, path) => {
            const variable = varMap.get(path);
            if (variable) {
                entry.variableData = variable;
                entry.visualizer.update(variable);
            }
        });

        // 3. Restore active blocks on fresh load (no visible blocks yet, but varMap has data)
        if (this.blocks.size === 0 && varMap.size > 0 && typeof currentState !== 'undefined' && currentState.blocks) {
            currentState.blocks.forEach(b => {
                if (b.active === false) return; // was unchecked when saved
                const variable = varMap.get(b.path);
                if (variable && !this.blocks.has(b.path)) {
                    this.createBlockWithPath(
                        b.path, variable,
                        b.x !== undefined ? b.x : null,
                        b.y !== undefined ? b.y : null,
                        b.type || 'Text'
                    );
                }
            });
        }

        // 4. Remove blocks whose variables are no longer in scope
        const toRemove = [];
        this.blocks.forEach((entry, path) => {
            if (!varMap.has(path)) toRemove.push(path);
        });
        toRemove.forEach(path => {
            const checkbox = document.querySelector(`.var-checkbox[data-path="${path}"]`);
            if (checkbox) /** @type {HTMLInputElement} */(checkbox).checked = false;
            this.removeBlock(path);
        });
        if (toRemove.length > 0 && window.controller) window.controller.saveState();
    }

    // @ts-ignore
    createBlockWithPath(path, variable, x = null, y = null, type = 'Text') {
        if (!this.dashboard) return;
        if (this.blocks.has(path)) return;

        const empty = this.dashboard.querySelector('.empty-state-canvas');
        if (empty) /** @type {HTMLElement} */(empty).style.display = 'none';

        // Prefer remembered position / type / size over passed-in defaults
        const known = this.knownBlocks.get(path);
        if (known) {
            if (x === null && known.x !== null) x = known.x;
            if (y === null && known.y !== null) y = known.y;
            if (type === 'Text' && known.type && known.type !== 'Text') type = known.type;
        }

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

        // ── Header: title + close only (type select lives in the popup) ────────
        const header = document.createElement('div');
        header.className = 'block-header';

        const title = document.createElement('span');
        title.className = 'block-title';
        title.textContent = variable.name;
        title.style.flex = '1';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'block-btn';
        closeBtn.textContent = '✕';
        closeBtn.onmousedown = (e) => e.stopPropagation();
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            const checkbox = document.querySelector(`.var-checkbox[data-path="${path}"]`);
            if (checkbox) /** @type {HTMLInputElement} */(checkbox).checked = false;
            this.removeBlock(path);
            // @ts-ignore
            if (window.controller) window.controller.saveState();
        };

        header.appendChild(title);
        header.appendChild(closeBtn);

        // ── Block-wide Drag + Click (drag from anywhere, popup toggle if no drag) ──
        block.onmousedown = (e) => {
            // Ignore clicks on interactive children (inputs, selects, buttons)
            const tag = /** @type {HTMLElement} */(e.target).tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION') return;
            if (e.target === closeBtn) return;

            // Let the native CSS resize handle (bottom-right corner ~16px) work unobstructed
            const rect = block.getBoundingClientRect();
            if (e.clientX >= rect.right - 16 && e.clientY >= rect.bottom - 16) return;

            e.preventDefault();
            this.blocks.forEach(b => b.element.style.zIndex = '10');
            block.style.zIndex = '100';

            const startX = e.clientX, startY = e.clientY;
            const startLeft = parseFloat(block.style.left) || 0;
            const startTop  = parseFloat(block.style.top)  || 0;
            let   didDrag   = false;

            // @ts-ignore
            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                if (Math.abs(dx) + Math.abs(dy) > 4) didDrag = true;
                block.style.left = `${startLeft + dx}px`;
                block.style.top  = `${startTop  + dy}px`;
                // Keep popup anchored to the block while dragging
                const entry = this.blocks.get(path);
                if (entry && this.activePopupPath === path) this._showPopup(entry);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                const kb = this.knownBlocks.get(path);
                if (kb) {
                    kb.x = parseInt(block.style.left) || 0;
                    kb.y = parseInt(block.style.top)  || 0;
                }
                // @ts-ignore
                if (window.controller) window.controller.saveState();

                // If no meaningful drag happened, treat as a click → toggle popup
                if (!didDrag) {
                    const entry = this.blocks.get(path);
                    if (this.activePopupPath === path) {
                        this._closeActivePopup();
                    } else {
                        this._closeActivePopup();
                        if (entry) {
                            block.classList.add('block--popup-open');
                            this._showPopup(entry);
                            this.activePopupPath = path;
                        }
                    }
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const content = document.createElement('div');
        content.className = 'block-content';

        block.appendChild(header);
        block.appendChild(content);
        this.dashboard.appendChild(block);

        // ── Popup (sibling in dashboard, revealed on click) ───────────────────
        const popup = document.createElement('div');
        popup.className = 'block-popup';
        popup.style.display = 'none';
        popup.dataset.path = path;

        // Type row
        const typeRow = document.createElement('div');
        typeRow.className = 'block-popup-type';
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Type: ';
        const typeSelect = document.createElement('select');
        typeSelect.className = 'viz-type-select';
        typeSelect.onmousedown = (e) => e.stopPropagation();
        if (typeof visualizerRegistry !== 'undefined') {
            visualizerRegistry.getAllTypes().forEach(t => {
                const opt = document.createElement('option');
                opt.value = t; opt.textContent = t;
                if (t === type) opt.selected = true;
                typeSelect.appendChild(opt);
            });
        }
        typeSelect.onchange = (e) => {
            // @ts-ignore
            this.switchVisualizer(path, e.target.value);
        };
        typeLabel.appendChild(typeSelect);
        typeRow.appendChild(typeLabel);
        popup.appendChild(typeRow);

        // Close popup when clicking outside both block and popup
        // (handled globally via _closeActivePopup called on new open)
        this.dashboard.appendChild(popup);

        let safeType = type;
        if (typeof visualizerRegistry !== 'undefined') {
             if (!visualizerRegistry.registry.has(type)) safeType = 'Text';
             const visualizer = visualizerRegistry.create(safeType, content);

             // Restore saved params BEFORE update() so auto-detect doesn't overwrite them
             const savedParams = known ? (known.params || {}) : {};
             if (visualizer.setParams) visualizer.setParams(savedParams);

             // Toolbar for this visualizer goes into the popup (not the block)
             const toolbar = visualizer.getToolbar ? visualizer.getToolbar() : null;
             if (toolbar) {
                 toolbar.classList.add('block-toolbar');
                 popup.appendChild(toolbar);
             }

             visualizer.update(variable);

             // Record in knownBlocks (creates entry if first time)
             this.knownBlocks.set(path, {
                 x: parseInt(block.style.left) || 0,
                 y: parseInt(block.style.top)  || 0,
                 type: safeType,
                 w: null, h: null,
                 params: visualizer.getParams ? visualizer.getParams() : {}
             });

             // Auto-size; restore saved w/h if they exist
             this.autoSizeBlock(block, content);
             const kb = this.knownBlocks.get(path);
             if (known && known.w && known.h) {
                 block.style.width  = `${known.w}px`;
                 block.style.height = `${known.h}px`;
                 if (kb) { kb.w = known.w; kb.h = known.h; }
             }

             // ResizeObserver: scale header proportionally as the block is resized
             const naturalW = parseInt(block.style.width) || 200;
             const ro = new ResizeObserver(() => {
                 const scale = Math.max(0.55, Math.min(1, block.offsetWidth / naturalW));
                 block.style.setProperty('--block-scale', scale);
             });
             ro.observe(block);

             this.blocks.set(path, {
                 element:         block,
                 visualizer:      visualizer,
                 contentElement:  content,
                 variableData:    variable,
                 type:            safeType,
                 popup:           popup,
                 resizeObserver:  ro
             });
        }
    }

    // ── Popup helpers ─────────────────────────────────────────────────────────

    _closeActivePopup() {
        if (!this.activePopupPath) return;
        const prev = this.blocks.get(this.activePopupPath);
        if (prev) {
            prev.popup.style.display = 'none';
            prev.element.classList.remove('block--popup-open');
        }
        this.activePopupPath = null;
    }

    _showPopup(entry) {
        const popup = entry.popup;
        const block = entry.element;

        // Measure popup at its natural size off-screen first
        popup.style.visibility = 'hidden';
        popup.style.left = '-9999px';
        popup.style.top  = '-9999px';
        popup.style.display = 'flex';

        const popupW = popup.offsetWidth;
        const popupH = popup.offsetHeight;

        const blockLeft = parseFloat(block.style.left) || 0;
        const blockTop  = parseFloat(block.style.top)  || 0;
        const blockW    = block.offsetWidth;
        const blockH    = block.offsetHeight;
        const dashW     = this.dashboard.clientWidth;
        // Use scrollHeight so popup can be placed below even when dashboard scrolls
        const dashH     = Math.max(this.dashboard.clientHeight, this.dashboard.scrollHeight);
        const GAP = 8;

        let left, top;
        // Prefer right of block
        if (blockLeft + blockW + GAP + popupW <= dashW) {
            left = blockLeft + blockW + GAP;
            top  = blockTop;
        // Then left of block
        } else if (blockLeft - GAP - popupW >= 0) {
            left = blockLeft - GAP - popupW;
            top  = blockTop;
        // Fallback: below block
        } else {
            left = blockLeft;
            top  = blockTop + blockH + GAP;
        }

        // Clamp so popup never leaves the dashboard
        left = Math.max(0, Math.min(left, Math.max(0, dashW - popupW)));
        top  = Math.max(0, Math.min(top,  Math.max(0, dashH - popupH)));

        popup.style.left       = `${left}px`;
        popup.style.top        = `${top}px`;
        popup.style.visibility = '';
    }

    autoSizeBlock(block, content) {
        // If the visualizer's own _resizeBlock already set explicit dimensions, trust it.
        if (block.dataset.vizSized === '1') {
            delete block.dataset.vizSized;
            const path = block.dataset.path;
            if (path) {
                const kb = this.knownBlocks.get(path);
                if (kb) {
                    kb.w = parseInt(block.style.width)  || null;
                    kb.h = parseInt(block.style.height) || null;
                }
            }
            return;
        }

        // Set to auto so the block shrinks to its natural size
        block.style.width = 'auto';
        block.style.height = 'auto';
        block.style.display = 'inline-flex';

        // Measure the full block (header + toolbar + content) in one shot
        const naturalWidth  = Math.max(block.scrollWidth,  150);
        const naturalHeight = Math.max(block.scrollHeight, 80);

        block.style.display = 'flex';
        block.style.width  = `${naturalWidth}px`;
        block.style.height = `${naturalHeight}px`;

        // Update knownBlocks with measured size
        const path = block.dataset.path;
        if (path) {
            const kb = this.knownBlocks.get(path);
            if (kb) { kb.w = naturalWidth; kb.h = naturalHeight; }
        }
    }

    // @ts-ignore
    switchVisualizer(path, newType) {
        const entry = this.blocks.get(path);
        if (!entry) return;

        // Save current params to knownBlocks before destroying visualizer
        const kb = this.knownBlocks.get(path);
        if (kb && entry.visualizer.getParams) kb.params = entry.visualizer.getParams();

        if (entry.visualizer.dispose) entry.visualizer.dispose();

        // Remove existing toolbar from the popup (not from the block)
        const existingToolbar = entry.popup && entry.popup.querySelector('.block-toolbar');
        if (existingToolbar) existingToolbar.remove();

        entry.contentElement.innerHTML = '';

        if (typeof visualizerRegistry !== 'undefined') {
            const newViz = visualizerRegistry.create(newType, entry.contentElement);

            // Toolbar goes into the popup
            const newToolbar = newViz.getToolbar ? newViz.getToolbar() : null;
            if (newToolbar && entry.popup) {
                newToolbar.classList.add('block-toolbar');
                entry.popup.appendChild(newToolbar);
            }

            // Restore saved params for this new type if any were previously used
            if (newViz.setParams && kb && kb.params) newViz.setParams(kb.params);

            newViz.update(entry.variableData);
            entry.visualizer = newViz;
            entry.type = newType;

            // Update knownBlocks with new type
            if (kb) kb.type = newType;
            else this.knownBlocks.set(path, { x: parseInt(entry.element.style.left)||0, y: parseInt(entry.element.style.top)||0, type: newType, w: null, h: null, params: {} });
            
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
            // Persist final params + position + size to knownBlocks before removing
            const kb = this.knownBlocks.get(path);
            if (kb) {
                if (entry.visualizer.getParams) kb.params = entry.visualizer.getParams();
                kb.x = parseInt(entry.element.style.left)  || kb.x || 0;
                kb.y = parseInt(entry.element.style.top)   || kb.y || 0;
                kb.w = parseInt(entry.element.style.width) || kb.w || null;
                kb.h = parseInt(entry.element.style.height)|| kb.h || null;
            }
            // Close popup if it was open for this block
            if (this.activePopupPath === path) this._closeActivePopup();
            // Remove popup sibling and disconnect ResizeObserver
            if (entry.popup) entry.popup.remove();
            if (entry.resizeObserver) entry.resizeObserver.disconnect();
            entry.element.remove();
            this.blocks.delete(path);
        }
        if (this.blocks.size === 0 && this.dashboard) {
            const empty = this.dashboard.querySelector('.empty-state-canvas');
            if (empty) /** @type {HTMLElement} */(empty).style.display = 'block';
        }
    }

    getLayout() {
        // Return ALL knownBlocks (active and inactive) so state is fully preserved.
        // active=true means the block DOM is currently shown on the canvas.
        const layout = [];
        this.knownBlocks.forEach((kb, path) => {
            const entry = this.blocks.get(path);
            // Pick up live position/size from the DOM if the block is currently visible
            if (entry) {
                kb.x = parseInt(entry.element.style.left)  || kb.x || 0;
                kb.y = parseInt(entry.element.style.top)   || kb.y || 0;
                kb.w = parseInt(entry.element.style.width) || kb.w || null;
                kb.h = parseInt(entry.element.style.height)|| kb.h || null;
                if (entry.visualizer.getParams) kb.params = entry.visualizer.getParams();
            }
            layout.push({
                path:   path,
                x:      kb.x    || 0,
                y:      kb.y    || 0,
                type:   kb.type || 'Text',
                w:      kb.w    || null,
                h:      kb.h    || null,
                params: kb.params || {},
                active: this.blocks.has(path)
            });
        });
        return layout;
    }
}
