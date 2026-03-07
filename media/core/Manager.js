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
            this.switchVisualizer(path, e.target.value);
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
                 }
                 // Reposition popup if it's open for this block
                 if (this.activePopupPath === path && entry2) {
                     this._showPopup(entry2);
                 }
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

        const candidates = [
            { left: blockLeft,                 top: blockTop - popupH - GAP },
            { left: blockLeft,                 top: blockTop + blockH + GAP },
            { left: blockLeft - popupW - GAP,  top: blockTop },
            { left: blockLeft + blockW + GAP,  top: blockTop }
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

            return { rank, totalOverlapArea, idx, left, top };
        });

        scored.sort((a, b) => (a.rank - b.rank) || (a.totalOverlapArea - b.totalOverlapArea) || (a.idx - b.idx));
        const best = scored[0];

        popup.style.left       = `${best.left}px`;
        popup.style.top        = `${best.top}px`;
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
                // SVG path: clone SVG with all computed styles inlined
                blob = await this._svgToBlob(svgEl, block);
            } else {
                // HTML path: use foreignObject approach with proper CSS
                blob = await this._htmlToBlob(block);
            }
            if (blob && navigator.clipboard && navigator.clipboard.write) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setTemp('✓');
            } else if (blob) {
                // Fallback: trigger file download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'block.png'; a.click();
                URL.revokeObjectURL(url);
                setTemp('↓');
            } else {
                setTemp('✗');
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
     * Capture HTML block to PNG blob using foreignObject SVG technique.
     * This closely follows the html-to-image library approach.
     */
    _htmlToBlob(block) {
        return new Promise((resolve) => {
            const w = block.offsetWidth  || 400;
            const h = block.offsetHeight || 300;
            
            // Clone the block and inline all computed styles
            const clone = block.cloneNode(true);
            this._inlineComputedStyles(block, clone);
            
            // Remove interactive elements that cause issues
            clone.querySelectorAll('input, button, select, textarea').forEach(el => {
                el.disabled = true;
            });
            
            // Get the HTML content with properly escaped characters
            const htmlContent = new XMLSerializer().serializeToString(clone);
            
            // Create foreignObject SVG wrapper
            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
                <foreignObject x="0" y="0" width="100%" height="100%">
                    ${htmlContent}
                </foreignObject>
            </svg>`;
            
            const blobIn = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blobIn);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 2;
                canvas.width = w * scale;
                canvas.height = h * scale;
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = '#32323e';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                canvas.toBlob(resolve, 'image/png');
            };
            img.onerror = (e) => { 
                console.error('[YTP] HTML render error:', e);
                URL.revokeObjectURL(url); 
                // Fallback to simple canvas approach
                this._htmlToBlobFallback(block).then(resolve);
            };
            img.src = url;
        });
    }

    /**
     * Recursively inline all computed styles from source to clone.
     */
    _inlineComputedStyles(source, clone) {
        if (source.nodeType !== 1) return;
        
        const computed = window.getComputedStyle(source);
        // Key properties to inline for visual fidelity
        const props = [
            'background-color', 'background', 'color', 'font-family', 'font-size', 
            'font-weight', 'font-style', 'text-align', 'text-decoration', 'line-height',
            'border', 'border-color', 'border-width', 'border-style', 'border-radius',
            'padding', 'margin', 'width', 'height', 'min-width', 'min-height',
            'max-width', 'max-height', 'display', 'flex-direction', 'justify-content',
            'align-items', 'flex-wrap', 'gap', 'overflow', 'position', 'top', 'left',
            'right', 'bottom', 'box-sizing', 'opacity', 'visibility', 'white-space',
            'word-wrap', 'word-break', 'fill', 'stroke', 'stroke-width'
        ];
        
        const styles = [];
        props.forEach(prop => {
            const val = computed.getPropertyValue(prop);
            if (val && val !== 'initial' && val !== 'none' && val !== 'auto') {
                styles.push(`${prop}:${val}`);
            }
        });
        
        // Also copy existing inline styles
        if (source.style && source.style.cssText) {
            styles.push(source.style.cssText);
        }
        
        clone.setAttribute('style', styles.join(';'));
        
        // Set xmlns for HTML elements in SVG foreignObject
        if (!clone.getAttribute('xmlns')) {
            clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        }
        
        // Recurse
        for (let i = 0; i < source.children.length; i++) {
            if (clone.children[i]) {
                this._inlineComputedStyles(source.children[i], clone.children[i]);
            }
        }
    }

    /**
     * Simple fallback using manual canvas rendering.
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
            
            // Background
            ctx.fillStyle = '#32323e';
            ctx.fillRect(0, 0, w, h);
            
            // Header
            const header = block.querySelector('.block-header');
            if (header) {
                ctx.fillStyle = '#2d2d2d';
                ctx.fillRect(0, 0, w, 30);
                ctx.fillStyle = '#ccc';
                ctx.font = '13px Consolas, monospace';
                const title = header.querySelector('.block-title');
                if (title) ctx.fillText(title.textContent || '', 10, 20);
            }
            
            // Content - simplified rendering
            const content = block.querySelector('.block-content');
            if (content) {
                const headerH = header ? 30 : 0;
                ctx.fillStyle = '#d4e8ff';
                ctx.font = '12px Consolas, monospace';
                
                // Render array boxes if present
                const boxes = content.querySelectorAll('.viz-array-box');
                if (boxes.length > 0) {
                    const contentRect = content.getBoundingClientRect();
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
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(valueEl.textContent || '', x + bw/2, y + bh*0.4);
                        }
                    });
                } else {
                    // Plain text
                    const text = content.textContent || '';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    const lines = text.split('\n').slice(0, 20);
                    lines.forEach((line, i) => {
                        ctx.fillText(line.substring(0, 80), 10, headerH + 10 + i * 16);
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
    switchVisualizer(path, newType) {
        const entry = this.blocks.get(path);
        if (!entry) return;

        // Capture current dimensions before switching
        const currentW = parseInt(entry.element.style.width) || entry.element.offsetWidth || null;
        const currentH = parseInt(entry.element.style.height) || entry.element.offsetHeight || null;

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
