// @ts-nocheck
console.log('[YTP] Manager.js loaded');

class VisualizerManager {
    constructor() {
        this.blocks          = new Map(); // path -> BlockEntry (currently visible)
        this.knownBlocks     = new Map(); // path -> {x,y,type,w,h,params} (persists across uncheck)
        this.dashboard       = document.getElementById('dashboard');
        this.activePopupPath = null;     // only one popup open at a time
        this._zTop           = 20;

        if (this.dashboard) {
            this.dashboard.style.overflow = 'hidden';
            this.dashboard.addEventListener('mouseover', (e) => {
                const t = e.target;
                if (t && t.closest && t.closest('.block')) {
                    this.dashboard.style.overflow = 'auto';
                }
            });
            this.dashboard.addEventListener('mouseleave', () => {
                this.dashboard.style.overflow = 'hidden';
            });
        }

        const sidebar = document.getElementById('sidebar');
        const variableList = document.getElementById('variable-list');
        if (sidebar && variableList) {
            variableList.style.overflowY = 'hidden';
            sidebar.addEventListener('mouseenter', () => {
                variableList.style.overflowY = 'auto';
            });
            sidebar.addEventListener('mouseleave', () => {
                variableList.style.overflowY = 'hidden';
            });
        }
    }

    // @ts-ignore
    hasBlock(path) {
        return this.blocks.has(path);
    }

    _bringToFront(block) {
        this._zTop += 1;
        block.style.zIndex = String(this._zTop);
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
                        params: b.params || {},
                        modifiers: b.modifiers || []
                    });
                }
            });
        }

        // 2. Update currently visible blocks
        this.blocks.forEach((entry, path) => {
            const variable = varMap.get(path);
            if (variable) {
                entry.variableData = variable;
                entry.visualizer.update(variable, varMap);
                // Apply modifiers after render
                this._applyModifiers(entry, varMap);
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
                        b.type || 'Text',
                        varMap
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
    createBlockWithPath(path, variable, x = null, y = null, type = 'Text', allVariable) {
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
        block.style.zIndex = String(this._zTop);

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
            this._bringToFront(block);

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
                            this._bringToFront(block);
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
        this._bringToFront(block);

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
            this.switchVisualizer(path, e.target.value, allVariable);
        };
        typeLabel.appendChild(typeSelect);
        typeRow.appendChild(typeLabel);

        // Copy image button
        const copyImgBtn = document.createElement('button');
        copyImgBtn.className = 'block-btn block-copy-btn';
        copyImgBtn.title = 'Copy as image';
        copyImgBtn.textContent = '📋';
        copyImgBtn.onmousedown = (e) => e.stopPropagation();
        copyImgBtn.onclick = (e) => {
            e.stopPropagation();
            const entry = this.blocks.get(path);
            if (entry) this._captureBlockImage(entry.element, copyImgBtn);
        };
        typeRow.appendChild(copyImgBtn);
        popup.appendChild(typeRow);

        // ── Tab bar ──
        const tabBar = document.createElement('div');
        tabBar.className = 'popup-tab-bar';
        const tabNames = ['Basic', 'Modification', 'Advanced'];
        const pages = {};
        tabNames.forEach((name, idx) => {
            const tab = document.createElement('button');
            tab.className = 'popup-tab' + (idx === 0 ? ' popup-tab--active' : '');
            tab.textContent = name;
            tab.dataset.page = name;
            tab.addEventListener('mousedown', e => e.stopPropagation());
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                tabBar.querySelectorAll('.popup-tab').forEach(t => t.classList.remove('popup-tab--active'));
                tab.classList.add('popup-tab--active');
                Object.values(pages).forEach(p => p.classList.remove('popup-page--active'));
                pages[name].classList.add('popup-page--active');
            });
            tabBar.appendChild(tab);

            const page = document.createElement('div');
            page.className = 'popup-page' + (idx === 0 ? ' popup-page--active' : '');
            pages[name] = page;
        });
        popup.appendChild(tabBar);
        tabNames.forEach(name => popup.appendChild(pages[name]));

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

             // Toolbar for this visualizer goes into the Basic page
             const toolbar = visualizer.getToolbar ? visualizer.getToolbar() : null;
             if (toolbar) {
                 toolbar.classList.add('block-toolbar');
                 pages['Basic'].appendChild(toolbar);
             }

             // Modifier section in the Modification page
             const modSection = document.createElement('div');
             modSection.className = 'modifier-section';
             pages['Modification'].appendChild(modSection);

             // Advanced settings from visualizer (if provided)
             if (visualizer.getAdvancedSettingsUI) {
                 const advUI = visualizer.getAdvancedSettingsUI();
                 if (advUI) pages['Advanced'].appendChild(advUI);
             }

             visualizer.update(variable, allVariable);

             // Record in knownBlocks (creates entry if first time)
             const existingMods = known ? (known.modifiers || []) : [];
             this.knownBlocks.set(path, {
                 x: parseInt(block.style.left) || 0,
                 y: parseInt(block.style.top)  || 0,
                 type: safeType,
                 w: null, h: null,
                 params: visualizer.getParams ? visualizer.getParams() : {},
                 modifiers: existingMods
             });

             // ── Size block: visualizer reports desired size → Manager clamps to dashboard → calls onContainerResize
             this._sizeBlock(block, content, visualizer, known ? known.w : null, known ? known.h : null);

             // ResizeObserver: scale header proportionally AND notify visualizer
             const naturalW = parseInt(block.style.width) || 200;
             const ro = new ResizeObserver(() => {
                 const scale = Math.max(0.55, Math.min(1, block.offsetWidth / naturalW));
                 block.style.setProperty('--block-scale', scale);
                 // Notify the visualizer so it can reflow content
                 const entry2 = this.blocks.get(path);
                 if (entry2 && entry2.visualizer.onContainerResize) {
                     entry2.visualizer.onContainerResize(
                         entry2.contentElement.clientWidth,
                         entry2.contentElement.clientHeight
                     );
                     // Re-apply modifiers after resize since DOM elements may have been recreated
                     const vm = window.controller ? window.controller.varMap : new Map();
                     this._applyModifiers(entry2, vm);
                 }
                 // Reposition popup if it's open for this block
                 if (this.activePopupPath === path && entry2) {
                     this._showPopup(entry2);
                 }
             });
             ro.observe(block);

             // ResizeObserver on popup: re-anchor when popup size changes
             const popupRO = new ResizeObserver(() => {
                 if (this.activePopupPath === path) {
                     const entry2 = this.blocks.get(path);
                     if (entry2) this._showPopup(entry2);
                 }
             });
             popupRO.observe(popup);

             this.blocks.set(path, {
                 element:         block,
                 visualizer:      visualizer,
                 contentElement:  content,
                 variableData:    variable,
                 type:            safeType,
                 popup:           popup,
                 resizeObserver:  ro,
                 popupResizeObserver: popupRO,
                 modifierInstances: []
             });
             this._instantiateModifiers(this.blocks.get(path), path);
             this._refreshModifierUI(path);
             // Apply modifiers immediately after creation
             const createdEntry = this.blocks.get(path);
             if (createdEntry) {
                 const vm = window.controller ? window.controller.varMap : new Map();
                 this._applyModifiers(createdEntry, vm);
             }
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

        const selfRect = { left: blockLeft, top: blockTop, right: blockLeft + blockW, bottom: blockTop + blockH };
        const blockRects = [];
        this.blocks.forEach((b) => {
            const el = b.element;
            const l = parseFloat(el.style.left) || 0;
            const t = parseFloat(el.style.top)  || 0;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            blockRects.push({
                path: el.dataset.path,
                rect: { left: l, top: t, right: l + w, bottom: t + h }
            });
        });

        const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        const overlapArea = (a, b) => {
            const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return ix * iy;
        };

        // anchorBottom: true means the popup is above the block and should be
        // anchored at its bottom edge so that when resizing the popup grows upward.
        const candidates = [
            { left: blockLeft,                 top: blockTop - popupH - GAP, anchorBottom: true },
            { left: blockLeft,                 top: blockTop + blockH + GAP, anchorBottom: false },
            { left: blockLeft - popupW - GAP,  top: blockTop,                anchorBottom: false },
            { left: blockLeft + blockW + GAP,  top: blockTop,                anchorBottom: false }
        ];

        const scored = candidates.map((c, idx) => {
            const left = Math.max(0, Math.min(c.left, Math.max(0, dashW - popupW)));
            const top  = Math.max(0, Math.min(c.top,  Math.max(0, dashH - popupH)));
            const rect = { left, top, right: left + popupW, bottom: top + popupH };

            const overlapSelf = intersects(rect, selfRect);
            let overlapOthersCount = 0;
            let totalOverlapArea = 0;

            for (const br of blockRects) {
                const ov = overlapArea(rect, br.rect);
                if (ov <= 0) continue;
                totalOverlapArea += ov;
                if (br.path !== block.dataset.path) overlapOthersCount += 1;
            }

            let rank = 2;
            if (!overlapSelf && overlapOthersCount === 0) rank = 0;
            else if (!overlapSelf) rank = 1;

            return { rank, totalOverlapArea, idx, left, top, anchorBottom: c.anchorBottom };
        });

        scored.sort((a, b) => (a.rank - b.rank) || (a.totalOverlapArea - b.totalOverlapArea) || (a.idx - b.idx));
        const best = scored[0];

        popup.style.left = `${best.left}px`;
        popup.style.bottom = '';
        popup.style.top    = `${best.top}px`;
        popup.style.visibility = '';
    }

    // ── Position clamp: ensure block stays fully inside the visible dashboard ──────
    _clampBlockPosition(block, kb) {
        // getBoundingClientRect forces a synchronous reflow so dimensions are accurate
        // even when called immediately after the block is first sized.
        const dashRect = this.dashboard.getBoundingClientRect();
        const dashW = dashRect.width  || this.dashboard.clientWidth  || window.innerWidth;
        const dashH = dashRect.height || this.dashboard.clientHeight || window.innerHeight;
        // block.style.width/height is always set explicitly before this call
        const bW = parseInt(block.style.width)  || 200;
        const bH = parseInt(block.style.height) || 100;
        let x = parseFloat(block.style.left) || 0;
        let y = parseFloat(block.style.top)  || 0;
        if (x + bW > dashW) x = Math.max(0, dashW - bW - 2);
        if (y + bH > dashH) y = Math.max(0, dashH - bH - 2);
        block.style.left = `${x}px`;
        block.style.top  = `${y}px`;
        if (kb) { kb.x = x; kb.y = y; }
    }

    // ── Unified block sizing (init + after visualizer switch) ──────────────────────────
    // Sizes the block to the visualizer's desired dimensions, clamped to the available
    // dashboard space from the block's current position. Then calls onContainerResize.
    _sizeBlock(block, content, visualizer, knownW, knownH) {
        const headerEl = block.querySelector('.block-header');
        const headerH  = headerEl ? headerEl.offsetHeight : 30;

        const dashRect  = this.dashboard.getBoundingClientRect();
        const spawnX    = parseFloat(block.style.left) || 0;
        const spawnY    = parseFloat(block.style.top)  || 0;
        const maxBlockW = Math.max(200, dashRect.width  - spawnX - 4);
        const maxBlockH = Math.max(100, dashRect.height - spawnY - 4);

        let blockW, blockH;
        if (knownW && knownH) {
            // Restore saved size, re-clamp in case dashboard has shrunk
            blockW = Math.min(knownW, maxBlockW);
            blockH = Math.min(knownH, maxBlockH);
        } else {
            let desiredW, desiredH;
            if (block.dataset.vizSized === '1') {
                // Visualizer signalled its natural content size via getDesiredSize()
                delete block.dataset.vizSized;
                const ds = visualizer.getDesiredSize ? visualizer.getDesiredSize() : null;
                if (ds) { desiredW = ds.w; desiredH = ds.h + headerH; }
            }
            if (!desiredW) {
                // Fall back to DOM measurement
                block.style.width   = 'auto';
                block.style.height  = 'auto';
                block.style.display = 'inline-flex';
                desiredW = Math.max(block.scrollWidth,  150);
                desiredH = Math.max(block.scrollHeight, 80);
                block.style.display = 'flex';
            }
            blockW = Math.min(desiredW, maxBlockW);
            blockH = Math.min(desiredH, maxBlockH);
        }

        block.style.width  = `${blockW}px`;
        block.style.height = `${blockH}px`;

        // Persist dimensions to knownBlocks
        const path = block.dataset.path;
        if (path) {
            const kb = this.knownBlocks.get(path);
            if (kb) { kb.w = blockW; kb.h = blockH; }
        }

        // Notify visualizer of final content dimensions
        if (visualizer && visualizer.onContainerResize) {
            const cw = content.clientWidth  || blockW;
            const ch = content.clientHeight || (blockH - headerH);
            visualizer.onContainerResize(cw, ch);
        }

        // Shift block position if it now overflows the dashboard
        const kb2 = path ? this.knownBlocks.get(path) : null;
        this._clampBlockPosition(block, kb2);
    }

    // ── Max-size clamp (kept for legacy/direct use) ─────────────────────
    _clampBlockSize(block, visualizer, kb) {
        const MAX_W = 820;
        const MAX_H = 620;
        let w = parseInt(block.style.width)  || block.offsetWidth  || 0;
        let h = parseInt(block.style.height) || block.offsetHeight || 0;
        let changed = false;
        if (w > MAX_W) { w = MAX_W; changed = true; }
        if (h > MAX_H) { h = MAX_H; changed = true; }
        if (!changed) return;
        block.style.width  = `${w}px`;
        block.style.height = `${h}px`;
        if (kb) { kb.w = w; kb.h = h; }
        // Tell visualizer to refit its content to the new (smaller) container
        if (visualizer && visualizer.onContainerResize) {
            const content = block.querySelector('.block-content');
            const cw = content ? content.clientWidth  : w;
            const ch = content ? content.clientHeight : h;
            visualizer.onContainerResize(cw, ch);
        }
    }

    // ── Capture block as PNG and copy to clipboard ────────────────────────────
    async _captureBlockImage(block, triggerBtn) {
        const origText = triggerBtn ? triggerBtn.textContent : '';
        const setTemp = (text) => {
            if (!triggerBtn) return;
            triggerBtn.textContent = text;
            setTimeout(() => { triggerBtn.textContent = origText; }, 1200);
        };
        try {
            if (triggerBtn) triggerBtn.textContent = '⏳';
            const svgEl = block.querySelector('svg');
            let blob;
            if (svgEl) {
                blob = await this._svgToBlob(svgEl, block);
            } else {
                blob = await this._htmlToBlobFallback(block);
            }
            if (!blob) { setTemp('✗'); return; }

            // Try clipboard API first (works in regular browser, may fail in webview)
            let copied = false;
            try {
                if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    copied = true;
                }
            } catch (_) { /* clipboard API unavailable or blocked in webview */ }

            if (copied) {
                setTemp('✓');
            } else {
                // Fallback: trigger file download (works in both browser and webview)
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'block.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setTemp('↓');
            }
        } catch (err) {
            console.error('[YTP] captureBlockImage failed:', err);
            setTemp('✗');
        }
    }

    /**
     * Capture SVG visualizer to PNG blob.
     * Clones the SVG, inlines ALL computed styles recursively, then renders to canvas.
     */
    _svgToBlob(svgEl, block) {
        return new Promise((resolve) => {
            const NS = 'http://www.w3.org/2000/svg';
            const clone = /** @type {SVGSVGElement} */(svgEl.cloneNode(true));
            
            // Recursively inline ALL computed styles (not just a subset)
            const inlineAllStyles = (source, target) => {
                if (source.nodeType !== 1) return; // Only element nodes
                const computed = window.getComputedStyle(source);
                // Copy all computed styles to inline style
                const cssText = [];
                for (let i = 0; i < computed.length; i++) {
                    const prop = computed[i];
                    const val = computed.getPropertyValue(prop);
                    if (val) cssText.push(`${prop}:${val}`);
                }
                target.setAttribute('style', cssText.join(';'));
                
                // Recurse to children
                for (let i = 0; i < source.children.length; i++) {
                    if (target.children[i]) {
                        inlineAllStyles(source.children[i], target.children[i]);
                    }
                }
            };
            inlineAllStyles(svgEl, clone);
            
            // Ensure proper dimensions and namespace
            const vb = svgEl.viewBox ? svgEl.viewBox.baseVal : null;
            const w = (vb && vb.width > 0) ? vb.width  : (svgEl.clientWidth  || 400);
            const h = (vb && vb.height > 0) ? vb.height : (svgEl.clientHeight || 300);
            clone.setAttribute('width',  String(w));
            clone.setAttribute('height', String(h));
            clone.setAttribute('xmlns', NS);
            clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            
            // Remove any scripts or event handlers for safety
            clone.querySelectorAll('script').forEach(s => s.remove());
            
            const svgStr = new XMLSerializer().serializeToString(clone);
            const blobIn = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blobIn);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 2; // Retina quality
                canvas.width = w * scale;
                canvas.height = h * scale;
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                // Background
                ctx.fillStyle = '#1e1e1e';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                canvas.toBlob(resolve, 'image/png');
            };
            img.onerror = (e) => { 
                console.error('[YTP] SVG render error:', e);
                URL.revokeObjectURL(url); 
                resolve(null); 
            };
            img.src = url;
        });
    }

    /**
     * Capture HTML block to PNG blob using canvas-based rendering.
     * foreignObject SVG approach is unreliable (XHTML serialization issues,
     * blocked by CSP in VSCode webview), so we render directly to canvas.
     */
    _htmlToBlobFallback(block) {
        return new Promise((resolve) => {
            const w = block.offsetWidth || 400;
            const h = block.offsetHeight || 300;
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = w * scale;
            canvas.height = h * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);

            // Block background
            ctx.fillStyle = '#32323e';
            ctx.fillRect(0, 0, w, h);

            // Header
            const header = block.querySelector('.block-header');
            const headerH = header ? header.offsetHeight || 30 : 0;
            if (header) {
                ctx.fillStyle = '#2d2d2d';
                ctx.fillRect(0, 0, w, headerH);
                ctx.fillStyle = '#ccc';
                ctx.font = '13px Consolas, monospace';
                const title = header.querySelector('.block-title');
                if (title) ctx.fillText(title.textContent || '', 10, headerH * 0.65);
            }

            // Content rendering
            const content = block.querySelector('.block-content');
            if (content) {
                const contentRect = content.getBoundingClientRect();

                // Array boxes
                const boxes = content.querySelectorAll('.viz-array-box');
                if (boxes.length > 0) {
                    boxes.forEach(box => {
                        const rect = box.getBoundingClientRect();
                        const x = rect.left - contentRect.left;
                        const y = rect.top - contentRect.top + headerH;
                        const bw = rect.width;
                        const bh = rect.height;

                        ctx.fillStyle = '#1e3a5f';
                        ctx.fillRect(x, y, bw, bh);
                        ctx.strokeStyle = '#6e9ccf';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(x, y, bw, bh);

                        const valueEl = box.querySelector('.viz-array-value');
                        if (valueEl) {
                            ctx.fillStyle = '#d4e8ff';
                            ctx.font = '12px Consolas, monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(valueEl.textContent || '', x + bw / 2, y + bh * 0.4);
                        }
                        const idxEl = box.querySelector('.viz-array-index');
                        if (idxEl) {
                            ctx.fillStyle = '#888';
                            ctx.font = '9px Consolas, monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillText(idxEl.textContent || '', x + bw / 2, y + bh + 2);
                        }
                    });
                }

                // Matrix rows
                const matRows = content.querySelectorAll('.viz-matrix-row');
                if (matRows.length > 0) {
                    matRows.forEach(row => {
                        const cells = row.querySelectorAll('.viz-array-box');
                        cells.forEach(cell => {
                            const rect = cell.getBoundingClientRect();
                            const x = rect.left - contentRect.left;
                            const y = rect.top - contentRect.top + headerH;
                            const bw = rect.width;
                            const bh = rect.height;
                            ctx.fillStyle = '#1e3a5f';
                            ctx.fillRect(x, y, bw, bh);
                            ctx.strokeStyle = '#6e9ccf';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(x, y, bw, bh);
                            const val = cell.querySelector('.viz-array-value');
                            if (val) {
                                ctx.fillStyle = '#d4e8ff';
                                ctx.font = '11px Consolas, monospace';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(val.textContent || '', x + bw / 2, y + bh / 2);
                            }
                        });
                    });
                }

                // Heap circles
                const heapNodes = content.querySelectorAll('.viz-graph-node');
                if (heapNodes.length > 0) {
                    heapNodes.forEach(node => {
                        const rect = node.getBoundingClientRect();
                        const cx = rect.left - contentRect.left + rect.width / 2;
                        const cy = rect.top - contentRect.top + headerH + rect.height / 2;
                        const r = Math.min(rect.width, rect.height) / 2;
                        ctx.beginPath();
                        ctx.arc(cx, cy, r, 0, Math.PI * 2);
                        ctx.fillStyle = '#1e3a5f';
                        ctx.fill();
                        ctx.strokeStyle = '#6e9ccf';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        const text = node.querySelector('text');
                        if (text) {
                            ctx.fillStyle = '#d4e8ff';
                            ctx.font = '12px Consolas, monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(text.textContent || '', cx, cy);
                        }
                    });
                }

                // Plain text fallback (e.g., TextVisualizer)
                if (boxes.length === 0 && matRows.length === 0 && heapNodes.length === 0) {
                    const text = content.textContent || '';
                    ctx.fillStyle = '#d4e8ff';
                    ctx.font = '12px Consolas, monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    const lines = text.split('\n').slice(0, 30);
                    lines.forEach((line, i) => {
                        ctx.fillText(line.substring(0, 100), 10, headerH + 10 + i * 16);
                    });
                }
            }

            canvas.toBlob(resolve, 'image/png');
        });
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
    switchVisualizer(path, newType, allVariable) {
        const entry = this.blocks.get(path);
        if (!entry) return;

        // Capture current dimensions before switching
        const currentW = parseInt(entry.element.style.width) || entry.element.offsetWidth || null;
        const currentH = parseInt(entry.element.style.height) || entry.element.offsetHeight || null;

        // Save current params to knownBlocks before destroying visualizer
        const kb = this.knownBlocks.get(path);
        if (kb && entry.visualizer.getParams) kb.params = entry.visualizer.getParams();

        if (entry.visualizer.dispose) entry.visualizer.dispose();

        // Clear Basic and Advanced pages in popup; keep Modification intact
        const popupPages = entry.popup ? entry.popup.querySelectorAll('.popup-page') : [];
        const basicPage    = popupPages[0] || null;
        const advancedPage = popupPages[2] || null;
        if (basicPage)    basicPage.innerHTML = '';
        if (advancedPage) advancedPage.innerHTML = '';

        entry.contentElement.innerHTML = '';

        if (typeof visualizerRegistry !== 'undefined') {
            const newViz = visualizerRegistry.create(newType, entry.contentElement);

            // Toolbar goes into the Basic page
            const newToolbar = newViz.getToolbar ? newViz.getToolbar() : null;
            if (newToolbar && basicPage) {
                newToolbar.classList.add('block-toolbar');
                basicPage.appendChild(newToolbar);
            }

            // Advanced settings go into the Advanced page
            if (newViz.getAdvancedSettingsUI && advancedPage) {
                const advUI = newViz.getAdvancedSettingsUI();
                if (advUI) advancedPage.appendChild(advUI);
            }

            // Restore saved params for this new type if any were previously used
            if (newViz.setParams && kb && kb.params) newViz.setParams(kb.params);

            newViz.update(entry.variableData, allVariable);
            entry.visualizer = newViz;
            entry.type = newType;

            // Update knownBlocks with new type
            if (kb) kb.type = newType;
            else this.knownBlocks.set(path, { x: parseInt(entry.element.style.left)||0, y: parseInt(entry.element.style.top)||0, type: newType, w: null, h: null, params: {} });
            
            // Re-size using the original block dimensions (preserve user's size)
            this._sizeBlock(entry.element, entry.contentElement, newViz, currentW, currentH);
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
            // Remove popup sibling and disconnect ResizeObservers
            if (entry.popup) entry.popup.remove();
            if (entry.resizeObserver) entry.resizeObserver.disconnect();
            if (entry.popupResizeObserver) entry.popupResizeObserver.disconnect();
            entry.element.remove();
            this.blocks.delete(path);
        }
        if (this.blocks.size === 0 && this.dashboard) {
            const empty = this.dashboard.querySelector('.empty-state-canvas');
            if (empty) /** @type {HTMLElement} */(empty).style.display = 'block';
        }
    }

    // ── Modifier UI in popup ──────────────────────────────────────────────────

    /**
     * Rebuild the modifier list section inside a block's popup.
     * @param {string} path  Block variable path
     */
    _refreshModifierUI(path, expandIndex = -1) {
        const entry = this.blocks.get(path);
        if (!entry) return;
        const modSection = entry.popup.querySelector('.modifier-section');
        if (!modSection) return;
        modSection.innerHTML = '';

        const kb = this.knownBlocks.get(path);
        const modDefs = kb ? (kb.modifiers || []) : [];

        // Header
        const header = document.createElement('div');
        header.className = 'modifier-section-header';
        header.textContent = 'Modifiers';
        modSection.appendChild(header);

        // Modifier rows
        modDefs.forEach((mDef, idx) => {
            const row = document.createElement('div');
            row.className = 'modifier-row';

            const tag = document.createElement('span');
            tag.className = 'modifier-tag';
            const ModCls = typeof modifierRegistry !== 'undefined' ? modifierRegistry.get(mDef.type) : null;
            const accepts = ModCls && ModCls.acceptsType ? `(${ModCls.acceptsType})` : '';
            tag.textContent = `[${mDef.type}${accepts}]`;

            const varName = document.createElement('span');
            varName.className = 'modifier-var';
            varName.textContent = mDef.varPath || '—';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'block-btn modifier-remove';
            removeBtn.textContent = '×';
            removeBtn.onmousedown = (e) => e.stopPropagation();
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeModifier(path, idx);
                this._refreshModifierUI(path);
            };

            row.appendChild(tag);
            row.appendChild(varName);
            row.appendChild(removeBtn);

            // Expand/collapse settings on click
            const mi = entry.modifierInstances ? entry.modifierInstances[idx] : null;
            if (mi && mi.instance.getSettingsUI) {
                row.style.cursor = 'pointer';
                const expandSettings = () => {
                    const existing = row.nextElementSibling;
                    if (existing && existing.classList.contains('modifier-settings-panel')) {
                        existing.remove();
                        return;
                    }
                    // Collapse any other expanded settings
                    modSection.querySelectorAll('.modifier-settings-panel').forEach(p => p.remove());
                    const panel = mi.instance.getSettingsUI(() => {
                        // Settings changed — persist and re-apply
                        mDef.settings = mi.instance.getParams();
                        const vm = window.controller ? window.controller.varMap : new Map();
                        this._applyModifiers(entry, vm);
                        if (window.controller) window.controller.saveState();
                    });
                    if (panel) {
                        panel.classList.add('modifier-settings-panel');
                        panel.onmousedown = (ev) => ev.stopPropagation();
                        row.after(panel);
                    }
                };
                row.addEventListener('click', (e) => {
                    if (e.target === removeBtn) return;
                    e.stopPropagation();
                    expandSettings();
                });
                // Auto-expand settings for newly added modifier
                if (idx === expandIndex) {
                    expandSettings();
                }
            }

            modSection.appendChild(row);
        });

        // "+ Add modifier" button
        const addBtn = document.createElement('button');
        addBtn.className = 'block-btn modifier-add-btn';
        addBtn.textContent = '+ Add modifier';
        addBtn.onmousedown = (e) => e.stopPropagation();
        addBtn.onclick = (e) => {
            e.stopPropagation();
            this._showAddModifierPicker(path, modSection, addBtn);
        };
        modSection.appendChild(addBtn);
    }

    /**
     * Show a small inline picker to choose modifier type and bind variable.
     */
    _showAddModifierPicker(path, modSection, addBtn) {
        // Remove existing picker if any
        const existing = modSection.querySelector('.modifier-picker');
        if (existing) {
            if (typeof CustomDropdown !== 'undefined') CustomDropdown.detachAll(existing);
            existing.remove();
            return;
        }

        const picker = document.createElement('div');
        picker.className = 'modifier-picker';
        picker.onmousedown = (e) => e.stopPropagation();

        // ── Modifier type: native <select> (reliable in webview) ──
        const typeGroup = document.createElement('div');
        typeGroup.className = 'viz-control';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'viz-ctrl-label';
        typeLabel.textContent = 'Type: ';
        const typeInput = document.createElement('select');
        typeInput.className = 'viz-select';
        typeInput.addEventListener('mousedown', e => e.stopPropagation());
        const allTypes = (typeof modifierRegistry !== 'undefined')
            ? modifierRegistry.getAllTypes().sort()
            : [];
        allTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            const ModCls = modifierRegistry.get(t);
            const accepts = ModCls && ModCls.acceptsType ? `(${ModCls.acceptsType})` : '';
            opt.textContent = `${t}${accepts}`;
            typeInput.appendChild(opt);
        });
        typeGroup.appendChild(typeLabel);
        typeGroup.appendChild(typeInput);
        picker.appendChild(typeGroup);

        // ── Variable: text input with CustomDropdown ──
        // Show children of the block's variable first, then all other variables
        const varGroup = document.createElement('div');
        varGroup.className = 'viz-control';
        const varLabel = document.createElement('span');
        varLabel.className = 'viz-ctrl-label';
        varLabel.textContent = 'Var: ';
        const varInput = document.createElement('input');
        varInput.type = 'text';
        varInput.className = 'viz-input';
        varInput.placeholder = 'variable';
        varInput.addEventListener('mousedown', e => e.stopPropagation());

        const getVarOptions = () => {
            if (!window.controller || !window.controller.varMap) return [];

            const varMap = window.controller.varMap;
            const filter = varInput.value.trim();
            const allPaths = Array.from(varMap.keys()).sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: 'base' })
            );

            // First open (no text): only show this block's direct children.
            if (!filter) {
                const childPaths = [];
                const blockVar = varMap.get(path);
                if (blockVar && Array.isArray(blockVar.children)) {
                    blockVar.children.forEach(child => {
                        const childPath = `${path}.${child.name}`;
                        if (varMap.has(childPath)) childPaths.push(childPath);
                    });
                }
                return childPaths.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            }

            // When typing: search over all variables (prefix filter is handled by CustomDropdown).
            return allPaths;
        };
        if (typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(varInput, getVarOptions, {
                matchMode: 'prefix',
                sort: true,
                resetScrollOnShow: true
            });
        }
        varGroup.appendChild(varLabel);
        varGroup.appendChild(varInput);
        picker.appendChild(varGroup);

        // Confirm button
        const okBtn = document.createElement('button');
        okBtn.className = 'block-btn';
        okBtn.textContent = 'Add';
        okBtn.onclick = (e) => {
            e.stopPropagation();
            let modType = typeInput.value;
            let varPath = varInput.value.trim();

            if (window.controller && window.controller.varMap) {
                const paths = Array.from(window.controller.varMap.keys());
                const pathLo = varPath.toLowerCase();
                varPath = paths.find(p => p === varPath)
                    || paths.find(p => p.toLowerCase() === pathLo)
                    || paths.find(p => p.toLowerCase().startsWith(pathLo))
                    || varPath;
            }

            if (modType && varPath) {
                this.addModifier(path, modType, varPath);
                const kb2 = this.knownBlocks.get(path);
                const newIdx = kb2 && kb2.modifiers ? kb2.modifiers.length - 1 : -1;
                if (typeof CustomDropdown !== 'undefined') CustomDropdown.detachAll(picker);
                this._refreshModifierUI(path, newIdx);
            }
        };
        picker.appendChild(okBtn);

        addBtn.before(picker);
    }

    // ── Layout serialization ──────────────────────────────────────────────────

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
                modifiers: kb.modifiers || [],
                active: this.blocks.has(path)
            });
        });
        return layout;
    }

    // ── Modifier helpers ──────────────────────────────────────────────────────

    /**
     * Apply all modifiers attached to a block entry.
     * Called after visualizer.update() produces fresh element descriptors.
     * @param {Object} entry  Block entry from this.blocks
     * @param {Map} varMap    Current variable map
     */
    _applyModifiers(entry, varMap) {
        if (!entry.modifierInstances || entry.modifierInstances.length === 0) return;
        const elements = entry.visualizer.getElements ? entry.visualizer.getElements() : [];
        if (elements.length === 0) return;
        for (const mi of entry.modifierInstances) {
            mi.instance.clear(elements);
            const modData = mi.varPath ? varMap.get(mi.varPath) : null;
            mi.instance.apply(elements, modData);
        }
    }

    /**
     * Instantiate modifier objects for a block entry from its knownBlocks config.
     * Called once when the block is first created / restored.
     * @param {Object} entry  Block entry
     * @param {string} path   Variable path
     */
    _instantiateModifiers(entry, path) {
        const kb = this.knownBlocks.get(path);
        if (!kb || !kb.modifiers || kb.modifiers.length === 0) {
            entry.modifierInstances = [];
            return;
        }
        entry.modifierInstances = kb.modifiers.map(mDef => {
            const ModCls = typeof modifierRegistry !== 'undefined'
                ? modifierRegistry.get(mDef.type) : null;
            if (!ModCls) return null;
            const inst = new ModCls(mDef.settings || {});
            return { type: mDef.type, varPath: mDef.varPath, instance: inst };
        }).filter(Boolean);
    }

    /**
     * Add a modifier to a block.
     * @param {string} path       Block's variable path
     * @param {string} modType    Modifier type key (e.g. 'pointer', 'color')
     * @param {string} varPath    Variable path the modifier reads from
     * @param {Object} settings   Initial settings
     */
    addModifier(path, modType, varPath, settings = {}) {
        const kb = this.knownBlocks.get(path);
        if (!kb) return;
        if (!kb.modifiers) kb.modifiers = [];
        kb.modifiers.push({ type: modType, varPath, settings });

        const entry = this.blocks.get(path);
        if (entry) {
            const ModCls = typeof modifierRegistry !== 'undefined'
                ? modifierRegistry.get(modType) : null;
            if (ModCls) {
                if (!entry.modifierInstances) entry.modifierInstances = [];
                const inst = new ModCls(settings);
                entry.modifierInstances.push({ type: modType, varPath, instance: inst });
            }
            // Apply modifiers immediately
            const vm = window.controller ? window.controller.varMap : new Map();
            this._applyModifiers(entry, vm);
        }
        if (window.controller) window.controller.saveState();
    }

    /**
     * Remove a modifier from a block by index.
     * @param {string} path   Block's variable path
     * @param {number} idx    Index in the modifier list
     */
    removeModifier(path, idx) {
        const kb = this.knownBlocks.get(path);
        if (!kb || !kb.modifiers) return;
        kb.modifiers.splice(idx, 1);

        const entry = this.blocks.get(path);
        if (entry && entry.modifierInstances) {
            const removed = entry.modifierInstances.splice(idx, 1);
            if (removed[0] && removed[0].instance.dispose) removed[0].instance.dispose();
        }
        if (window.controller) window.controller.saveState();
    }
}
