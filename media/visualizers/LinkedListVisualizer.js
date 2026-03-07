// @ts-nocheck
console.log('[YTP] LinkedListVisualizer.js loaded');

class LinkedListVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);

        // ── state ──────────────────────────────────────────────────────────────
        this.variable   = null;
        this.dataFields = [];          // string[]   – names of fields to show as node data
        this.pointers   = [];          // {fieldName, nickname}[] – pointer/edge fields
        this.layout     = 'layer';     // 'layer' | 'spring' | 'circle'
        this.layerRoot  = null;        // null=auto | number=fixed BFS root index
        this.directed   = true;

        // ── graph data ─────────────────────────────────────────────────────────
        this._nodes = [];  // {id, x, y, data:[{name,value}]}
        this._edges = [];  // {from, to, label}
        this._nodeIndexById = new Map();

        // ── DOM ────────────────────────────────────────────────────────────────
        this._svgContainer = document.createElement('div');
        this._svgContainer.className = 'viz-graph-container';
        this.container.appendChild(this._svgContainer);

        this._toolbar = this._buildToolbar();
    }

    getToolbar() { return this._toolbar; }

    getParams() {
        return {
            dataFields: this.dataFields.slice(),
            pointers:   this.pointers.map(p => ({ fieldName: p.fieldName, nickname: p.nickname })),
            layout:     this.layout,
            layerRoot:  this.layerRoot,
            directed:   this.directed
        };
    }

    setParams({ dataFields, pointers, layout, layerRoot, directed } = {}) {
        if (dataFields !== undefined) {
            this.dataFields = Array.isArray(dataFields) ? dataFields.slice() : [];
            this._syncDataFieldsUI();
        }
        if (pointers !== undefined) {
            this.pointers = Array.isArray(pointers) ? pointers.map(p => ({ fieldName: p.fieldName || '', nickname: p.nickname || '' })) : [];
            this._syncPointersUI();
        }
        if (layout    !== undefined && layout    !== null) { this.layout    = layout;    if (this._layoutSel) this._layoutSel.value = layout; }
        if (layerRoot !== undefined)                       { this.layerRoot = layerRoot === null ? null : parseInt(layerRoot); if (this._rootInput) this._rootInput.value = this.layerRoot === null ? '' : this.layerRoot; }
        if (directed  !== undefined && directed  !== null) { this.directed  = directed;  this._syncDirBtn(); }
        this._showHideRoot();
    }

    dispose() {}

    // ── Toolbar ────────────────────────────────────────────────────────────────

    _buildToolbar() {
        const tb = document.createElement('div');

        // ── Layout selector ──
        const layoutGroup = document.createElement('div');
        layoutGroup.className = 'viz-graph-control';
        const layoutLabel = document.createElement('label');
        layoutLabel.textContent = 'Layout: ';
        this._layoutSel = document.createElement('select');
        this._layoutSel.className = 'viz-graph-select';
        ['layer', 'spring', 'circle'].forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === this.layout) opt.selected = true;
            this._layoutSel.appendChild(opt);
        });
        this._layoutSel.addEventListener('mousedown', e => e.stopPropagation());
        this._layoutSel.addEventListener('change', e => {
            this.layout = e.target.value;
            if (this.layout === 'layer' && !this.directed && this.layerRoot === null) {
                this.layerRoot = 0;
                if (this._rootInput) this._rootInput.value = '0';
            }
            this._showHideRoot();
            this._refresh();
        });
        layoutLabel.appendChild(this._layoutSel);
        layoutGroup.appendChild(layoutLabel);
        tb.appendChild(layoutGroup);

        // ── Direction toggle ──
        const dirGroup = document.createElement('div');
        dirGroup.className = 'viz-graph-control';
        const dirLabel = document.createElement('label');
        dirLabel.textContent = 'Direction: ';
        this._dirBtn = document.createElement('button');
        this._dirBtn.className = 'viz-graph-toggle';
        this._dirBtn.addEventListener('mousedown', e => e.stopPropagation());
        this._dirBtn.addEventListener('click', () => {
            this.directed = !this.directed;
            this._syncDirBtn();
            if (!this.directed && this.layout === 'layer' && this.layerRoot === null) {
                this.layerRoot = 0;
                if (this._rootInput) this._rootInput.value = '0';
            }
            this._refresh();
        });
        this._syncDirBtn();
        dirLabel.appendChild(this._dirBtn);
        dirGroup.appendChild(dirLabel);
        tb.appendChild(dirGroup);

        // ── Root (layer only) ──
        this._rootWrap = document.createElement('div');
        this._rootWrap.className = 'viz-graph-control';
        this._rootWrap.style.display = 'none';
        const rootLabel = document.createElement('label');
        rootLabel.textContent = 'Root: ';
        this._rootInput = document.createElement('input');
        this._rootInput.type = 'number';
        this._rootInput.placeholder = 'auto';
        this._rootInput.className = 'viz-array-input';
        this._rootInput.style.minWidth = '50px';
        this._rootInput.addEventListener('mousedown', e => e.stopPropagation());
        this._rootInput.addEventListener('change', e => {
            this.layerRoot = e.target.value === '' ? null : parseInt(e.target.value);
            this._refresh();
        });
        rootLabel.appendChild(this._rootInput);
        this._rootWrap.appendChild(rootLabel);
        tb.appendChild(this._rootWrap);

        // ── Data Fields section ──
        const dataSection = document.createElement('div');
        dataSection.className = 'viz-ll-section';
        const dataSectionLabel = document.createElement('div');
        dataSectionLabel.className = 'viz-ll-section-title';
        dataSectionLabel.textContent = 'Data fields:';
        dataSection.appendChild(dataSectionLabel);
        this._dataFieldsContainer = document.createElement('div');
        this._dataFieldsContainer.className = 'viz-ll-rows';
        dataSection.appendChild(this._dataFieldsContainer);
        const addDataBtn = document.createElement('button');
        addDataBtn.className = 'viz-ll-add-btn';
        addDataBtn.textContent = '+ Add data field';
        addDataBtn.addEventListener('mousedown', e => e.stopPropagation());
        addDataBtn.addEventListener('click', () => {
            this.dataFields.push('');
            this._syncDataFieldsUI();
        });
        dataSection.appendChild(addDataBtn);
        tb.appendChild(dataSection);

        // ── Pointers section ──
        const ptrSection = document.createElement('div');
        ptrSection.className = 'viz-ll-section';
        const ptrSectionLabel = document.createElement('div');
        ptrSectionLabel.className = 'viz-ll-section-title';
        ptrSectionLabel.textContent = 'Pointers:';
        ptrSection.appendChild(ptrSectionLabel);
        this._pointersContainer = document.createElement('div');
        this._pointersContainer.className = 'viz-ll-rows';
        ptrSection.appendChild(this._pointersContainer);
        const addPtrBtn = document.createElement('button');
        addPtrBtn.className = 'viz-ll-add-btn';
        addPtrBtn.textContent = '+ Add pointer';
        addPtrBtn.addEventListener('mousedown', e => e.stopPropagation());
        addPtrBtn.addEventListener('click', () => {
            this.pointers.push({ fieldName: '', nickname: '' });
            this._syncPointersUI();
        });
        ptrSection.appendChild(addPtrBtn);
        tb.appendChild(ptrSection);

        this._showHideRoot();
        return tb;
    }

    _syncDirBtn() {
        if (!this._dirBtn) return;
        this._dirBtn.textContent = this.directed ? 'Directed' : 'Undirected';
        this._dirBtn.classList.toggle('viz-graph-toggle--active', !!this.directed);
    }

    _showHideRoot() {
        if (this._rootWrap) {
            this._rootWrap.style.display = this.layout === 'layer' ? 'flex' : 'none';
        }
    }

    _syncDataFieldsUI() {
        if (!this._dataFieldsContainer) return;
        this._dataFieldsContainer.innerHTML = '';
        this.dataFields.forEach((name, idx) => {
            const row = this._mkDataFieldRow(name, idx);
            this._dataFieldsContainer.appendChild(row);
        });
    }

    _syncPointersUI() {
        if (!this._pointersContainer) return;
        this._pointersContainer.innerHTML = '';
        this.pointers.forEach((ptr, idx) => {
            const row = this._mkPointerRow(ptr, idx);
            this._pointersContainer.appendChild(row);
        });
    }

    _mkDataFieldRow(name, idx) {
        const row = document.createElement('div');
        row.className = 'viz-ll-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'viz-ll-input';
        input.placeholder = 'field name';
        input.value = name;
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('change', e => {
            this.dataFields[idx] = e.target.value.trim();
            this._refresh();
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'viz-ll-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('mousedown', e => e.stopPropagation());
        removeBtn.addEventListener('click', () => {
            this.dataFields.splice(idx, 1);
            this._syncDataFieldsUI();
            this._refresh();
        });

        row.appendChild(input);
        row.appendChild(removeBtn);
        return row;
    }

    _mkPointerRow(ptr, idx) {
        const row = document.createElement('div');
        row.className = 'viz-ll-row';

        const fieldInput = document.createElement('input');
        fieldInput.type = 'text';
        fieldInput.className = 'viz-ll-input';
        fieldInput.placeholder = 'field name';
        fieldInput.value = ptr.fieldName;
        fieldInput.addEventListener('mousedown', e => e.stopPropagation());
        fieldInput.addEventListener('change', e => {
            this.pointers[idx].fieldName = e.target.value.trim();
            this._refresh();
        });

        const nickInput = document.createElement('input');
        nickInput.type = 'text';
        nickInput.className = 'viz-ll-input viz-ll-nick-input';
        nickInput.placeholder = 'nickname (opt.)';
        nickInput.value = ptr.nickname;
        nickInput.addEventListener('mousedown', e => e.stopPropagation());
        nickInput.addEventListener('change', e => {
            this.pointers[idx].nickname = e.target.value.trim();
            this._refresh();
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'viz-ll-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('mousedown', e => e.stopPropagation());
        removeBtn.addEventListener('click', () => {
            this.pointers.splice(idx, 1);
            this._syncPointersUI();
            this._refresh();
        });

        row.appendChild(fieldInput);
        row.appendChild(nickInput);
        row.appendChild(removeBtn);
        return row;
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    update(variable) {
        this.variable = variable;
        this._refresh();
    }

    _refresh() {
        const { nodes, edges } = this._parseLinkedList();
        this._nodes = nodes;
        this._edges = edges;
        this._nodeIndexById = new Map(nodes.map((n, i) => [n.id, i]));
        this._applyLayout();
        this._render();
    }

    // ── Parsing ────────────────────────────────────────────────────────────────

    /** Extract the last field name from an evaluateName or path string.
     *  e.g. "head->next->val" → "val"  |  "head.next.val" → "val" */
    _leafName(name) {
        const parts = name.split(/->|\./);
        for (let i = parts.length - 1; i >= 0; i--) {
            const s = parts[i].trim();
            if (s) return s;
        }
        return name;
    }

    _parseLinkedList() {
        const nodes = [];
        const edges = [];
        const visited = new Set();

        if (!this.variable) return { nodes, edges };

        const dataSet  = new Set(this.dataFields.filter(f => f));
        const ptrMap   = new Map(this.pointers.filter(p => p.fieldName).map(p => [p.fieldName, p.nickname]));

        const traverse = (varData, nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const nodeData = [];
            nodes.push({ id: nodeId, x: undefined, y: undefined, data: nodeData });

            if (!varData.children) return;

            for (const child of varData.children) {
                const leaf = this._leafName(child.name);

                if (dataSet.has(leaf)) {
                    nodeData.push({ name: leaf, value: child.value });
                }

                if (ptrMap.has(leaf) && child.children && child.children.length > 0) {
                    // child IS the target struct node; its evaluateName is its unique ID
                    const childId = child.name;
                    edges.push({ from: nodeId, to: childId, label: ptrMap.get(leaf) || '' });
                    // Only follow if not already visited (handles back-edges / cycles)
                    if (!visited.has(childId)) traverse(child, childId);
                }
            }
        };

        traverse(this.variable, this.variable.name);
        return { nodes, edges };
    }

    // ── Layout ─────────────────────────────────────────────────────────────────

    _nodeDims(node) {
        const ROW_H    = 16;
        const HEADER_H = 22;
        const PAD      = 8;
        const MIN_W    = 100;
        const CHAR_W   = 7;
        const h = HEADER_H + (node.data.length > 0 ? node.data.length * ROW_H + PAD : 0);
        // Width: fit longest data line
        let maxChars = Math.max(8, this._leafName(node.id).length);
        node.data.forEach(d => { maxChars = Math.max(maxChars, d.name.length + d.value.length + 3); });
        const w = Math.max(MIN_W, maxChars * CHAR_W + 16);
        return { w, h };
    }

    _canvasSize() {
        const n = Math.max(this._nodes.length, 1);
        if (this.layout === 'circle') {
            const spacing = 140;
            const r  = Math.max((spacing * n) / (2 * Math.PI), 80);
            const side = Math.ceil(r * 2 + 80);
            return { w: Math.max(side, 300), h: Math.max(side, 240) };
        }
        if (this.layout === 'layer') {
            const byLayer = this._computeLayers();
            const numL = byLayer.size;
            const maxPer = Math.max(...[...byLayer.values()].map(a => a.length), 1);
            return { w: Math.max((numL + 1) * 140, 300), h: Math.max((maxPer + 1) * 90, 240) };
        }
        // spring
        const side = Math.max(Math.ceil(Math.sqrt(n)) * 140 + 80, 300);
        return { w: side, h: Math.max(Math.ceil(side * 0.75), 240) };
    }

    _applyLayout() {
        if (this._nodes.length === 0) return;
        const { w, h } = this._canvasSize();
        if (this.layout === 'circle') {
            this._layoutCircle(w, h);
        } else if (this.layout === 'layer') {
            this._layoutLayer(w, h);
        } else {
            this._layoutSpring(w, h);
        }
    }

    _layoutCircle(w, h) {
        const r = Math.min(w, h) * 0.36;
        const cx = w / 2, cy = h / 2;
        this._nodes.forEach((nd, i) => {
            const a = (2 * Math.PI * i / this._nodes.length) - Math.PI / 2;
            nd.x = cx + r * Math.cos(a);
            nd.y = cy + r * Math.sin(a);
        });
    }

    _computeLayers() {
        const adj   = new Map(this._nodes.map((n, idx) => [idx, []]));
        const inDeg = new Map(this._nodes.map((_, idx) => [idx, 0]));
        const idToIdx = this._nodeIndexById;
        const seen  = new Set();
        for (const e of this._edges) {
            const fi = idToIdx.get(e.from);
            const ti = idToIdx.get(e.to);
            if (fi === undefined || ti === undefined || fi === ti) continue;
            const key = `${fi},${ti}`;
            if (seen.has(key)) continue;
            seen.add(key);
            adj.get(fi).push(ti);
            inDeg.set(ti, (inDeg.get(ti) || 0) + 1);
        }
        const layer = new Map();
        let roots;
        if (this.layerRoot !== null && this.layerRoot < this._nodes.length) {
            roots = [this.layerRoot];
        } else {
            roots = this._nodes
                .map((_, i) => i)
                .filter(i => (inDeg.get(i) || 0) === 0);
        }
        if (roots.length === 0 && this._nodes.length > 0) roots = [0];
        const queue = roots.slice();
        roots.forEach(i => layer.set(i, 0));
        let qi = 0;
        while (qi < queue.length) {
            const i = queue[qi++];
            for (const ni of (adj.get(i) || [])) {
                if (!layer.has(ni)) { layer.set(ni, layer.get(i) + 1); queue.push(ni); }
            }
        }
        const maxL = layer.size > 0 ? Math.max(...layer.values()) : 0;
        this._nodes.forEach((_, i) => { if (!layer.has(i)) layer.set(i, maxL + 1); });
        const byLayer = new Map();
        layer.forEach((l, i) => { if (!byLayer.has(l)) byLayer.set(l, []); byLayer.get(l).push(i); });
        return byLayer;
    }

    _layoutLayer(w, h) {
        const byLayer = this._computeLayers();
        const nL = byLayer.size;
        const lSpacing = w / (nL + 1);
        byLayer.forEach((idxList, l) => {
            const nSpacing = h / (idxList.length + 1);
            idxList.forEach((nodeIdx, i) => {
                const nd = this._nodes[nodeIdx];
                if (nd) { nd.x = (l + 1) * lSpacing; nd.y = (i + 1) * nSpacing; }
            });
        });
    }

    _layoutSpring(w, h) {
        const nodes = this._nodes;
        const n     = nodes.length;
        if (n === 0) return;
        const pad = 60;
        nodes.forEach((nd, i) => {
            if (nd.x === undefined || isNaN(nd.x)) {
                const a = (2 * Math.PI * i / n) - Math.PI / 2;
                nd.x = w / 2 + (w * 0.35) * Math.cos(a);
                nd.y = h / 2 + (h * 0.35) * Math.sin(a);
            }
        });
        const idToIdx = this._nodeIndexById;
        const nodeIdx = new Map(nodes.map((nd, i) => [nd.id, i]));
        const k = Math.sqrt((w * h) / n);
        for (let iter = 0; iter < 150; iter++) {
            const temp = k * (1 - iter / 150);
            const disp = nodes.map(() => ({ x: 0, y: 0 }));
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let dx = nodes[i].x - nodes[j].x || 0.01;
                    let dy = nodes[i].y - nodes[j].y || 0.01;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                    const force = (k * k) / dist;
                    const fx = (dx / dist) * force, fy = (dy / dist) * force;
                    disp[i].x += fx; disp[i].y += fy;
                    disp[j].x -= fx; disp[j].y -= fy;
                }
            }
            const seen = new Set();
            for (const e of this._edges) {
                const si = nodeIdx.get(e.from), ti = nodeIdx.get(e.to);
                if (si === undefined || ti === undefined || si === ti) continue;
                const key = [si, ti].sort().join(',');
                if (seen.has(key)) continue;
                seen.add(key);
                let dx = nodes[si].x - nodes[ti].x || 0.01;
                let dy = nodes[si].y - nodes[ti].y || 0.01;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const force = (dist * dist) / k;
                const fx = (dx / dist) * force, fy = (dy / dist) * force;
                disp[si].x -= fx; disp[si].y -= fy;
                disp[ti].x += fx; disp[ti].y += fy;
            }
            nodes.forEach((nd, i) => {
                const d = Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2) || 1;
                const scale = Math.min(d, temp) / d;
                nd.x += disp[i].x * scale;
                nd.y += disp[i].y * scale;
                nd.x = Math.max(pad, Math.min(w - pad, nd.x));
                nd.y = Math.max(pad, Math.min(h - pad, nd.y));
            });
        }
    }

    // ── SVG Rendering ──────────────────────────────────────────────────────────

    _render() {
        this._svgContainer.innerHTML = '';
        if (this._nodes.length === 0) {
            const msg = document.createElement('span');
            msg.className = 'viz-array-empty';
            msg.textContent = this.variable
                ? (this.dataFields.length === 0 && this.pointers.length === 0
                    ? 'Configure data/pointer fields in the settings panel.'
                    : '(empty — no matching nodes found)')
                : 'No data';
            this._svgContainer.appendChild(msg);
            return;
        }

        const { w, h } = this._canvasSize();
        const NS = 'http://www.w3.org/2000/svg';

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width',  '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'viz-graph-svg');

        // Defs: arrowhead
        const defs = document.createElementNS(NS, 'defs');
        defs.appendChild(this._mkArrow(NS, 'll-arrow', '#6e9ccf'));
        svg.appendChild(defs);

        // Edge layer (drawn below nodes)
        const edgeGroup = document.createElementNS(NS, 'g');
        svg.appendChild(edgeGroup);

        // Node layer
        const nodeGroup = document.createElementNS(NS, 'g');
        svg.appendChild(nodeGroup);

        // Draw nodes
        const nodeRects = new Map(); // id -> {x, y, w, h}
        for (const nd of this._nodes) {
            const dims = this._nodeDims(nd);
            const nx = nd.x - dims.w / 2;
            const ny = nd.y - dims.h / 2;
            nodeRects.set(nd.id, { x: nx, y: ny, w: dims.w, h: dims.h, cx: nd.x, cy: nd.y });

            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'viz-graph-node');
            g.setAttribute('transform', `translate(${nx},${ny})`);

            // Background rect
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('width',  dims.w);
            rect.setAttribute('height', dims.h);
            rect.setAttribute('rx', '5'); rect.setAttribute('ry', '5');
            rect.setAttribute('class', 'viz-ll-node-rect');
            g.appendChild(rect);

            // Header: show abbreviated node ID
            const HEADER_H = 22;
            const label = this._leafName(nd.id);
            const idText = document.createElementNS(NS, 'text');
            idText.setAttribute('x', dims.w / 2);
            idText.setAttribute('y', HEADER_H / 2);
            idText.setAttribute('text-anchor', 'middle');
            idText.setAttribute('dominant-baseline', 'central');
            idText.setAttribute('class', 'viz-ll-node-id');
            idText.textContent = label;
            g.appendChild(idText);

            // Separator line under header
            if (nd.data.length > 0) {
                const sep = document.createElementNS(NS, 'line');
                sep.setAttribute('x1', '0'); sep.setAttribute('y1', HEADER_H);
                sep.setAttribute('x2', dims.w); sep.setAttribute('y2', HEADER_H);
                sep.setAttribute('class', 'viz-ll-node-sep');
                g.appendChild(sep);

                // Data rows
                const ROW_H = 16;
                nd.data.forEach((d, i) => {
                    const row = document.createElementNS(NS, 'text');
                    row.setAttribute('x', '6');
                    row.setAttribute('y', HEADER_H + 4 + (i + 0.5) * ROW_H);
                    row.setAttribute('dominant-baseline', 'central');
                    row.setAttribute('class', 'viz-ll-node-text');
                    row.textContent = `${d.name}: ${d.value}`;
                    g.appendChild(row);
                });
            }

            nodeGroup.appendChild(g);

            // Node drag
            this._bindNodeDrag(g, nd, svg, NS, nodeRects, edgeGroup, dims);
        }

        // Draw edges
        this._drawAllEdges(NS, edgeGroup, nodeRects);

        this._svgContainer.appendChild(svg);

        // Store desired content size; Manager will size the block and call onContainerResize.
        this._desiredW = Math.max(w, 200);
        this._desiredH = Math.max(h, 80);
        const block = this.container.closest ? this.container.closest('.block') : null;
        if (block) {
            block.style.display = 'flex';
            block.dataset.vizSized = '1';
        }
    }

    _mkArrow(NS, id, color) {
        const marker = document.createElementNS(NS, 'marker');
        marker.setAttribute('id',           id);
        marker.setAttribute('markerWidth',  '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX',         '9');
        marker.setAttribute('refY',         '3.5');
        marker.setAttribute('orient',       'auto');
        const poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', '0 0, 10 3.5, 0 7');
        poly.setAttribute('fill',   color);
        marker.appendChild(poly);
        return marker;
    }

    _drawAllEdges(NS, group, nodeRects) {
        const edgeSet = new Set(this._edges.map(e => `${e.from}|||${e.to}`));
        const drawn   = new Set();
        for (const edge of this._edges) {
            const key = `${edge.from}|||${edge.to}`;
            if (drawn.has(key)) continue;
            drawn.add(key);
            const src = nodeRects.get(edge.from);
            const tgt = nodeRects.get(edge.to);
            if (!src || !tgt) continue;
            const revKey  = `${edge.to}|||${edge.from}`;
            const isBidi  = edgeSet.has(revKey);
            const isSelf  = edge.from === edge.to;

            if (isSelf) {
                this._drawSelfLoop(NS, group, src, edge);
            } else if (this.directed && isBidi) {
                this._drawCurved(NS, group, src, tgt,  1, edge, true);
                const rev = this._edges.find(e => e.from === edge.to && e.to === edge.from);
                this._drawCurved(NS, group, tgt, src, -1, rev || edge, true);
                drawn.add(revKey);
            } else if (this.directed) {
                this._drawCurved(NS, group, src, tgt, 0, edge, true);
            } else {
                this._drawCurved(NS, group, src, tgt, 0, edge, false);
                drawn.add(revKey);
            }
        }
    }

    /** Get the point on the border of a rect node closest to target point */
    _rectBorderPoint(rect, tx, ty) {
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        const dx = tx - cx, dy = ty - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        // Find intersection with rect border
        const hw = rect.w / 2, hh = rect.h / 2;
        const tx1 = hw / Math.abs(nx || 0.001), ty1 = hh / Math.abs(ny || 0.001);
        const t = Math.min(tx1, ty1);
        return { x: cx + nx * t, y: cy + ny * t };
    }

    _drawCurved(NS, group, src, tgt, curveDir, edge, withArrow) {
        const curvature = curveDir === 0 ? 25 : 45;
        const sign = curveDir === -1 ? -1 : 1;

        const p1 = this._rectBorderPoint(src, tgt.cx, tgt.cy);
        const p2 = this._rectBorderPoint(tgt, src.cx, src.cy);

        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;
        const cx = mx - ny * curvature * sign;
        const cy = my + nx * curvature * sign;

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`);
        path.setAttribute('class', 'viz-graph-edge');
        path.setAttribute('fill', 'none');
        if (withArrow) path.setAttribute('marker-end', 'url(#ll-arrow)');
        group.appendChild(path);

        if (edge.label) {
            const lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
            const ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('x', lx); lbl.setAttribute('y', ly);
            lbl.setAttribute('class', 'viz-graph-edge-label');
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('dominant-baseline', 'central');
            lbl.textContent = edge.label;
            group.appendChild(lbl);
        }
    }

    _drawSelfLoop(NS, group, rect, edge) {
        const cx = rect.x + rect.w / 2;
        const ty = rect.y - 30;
        const lx1 = cx - 15, lx2 = cx + 15;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d',
            `M ${lx1} ${rect.y} C ${lx1 - 28} ${ty} ${lx2 + 28} ${ty} ${lx2} ${rect.y}`);
        path.setAttribute('class', 'viz-graph-edge');
        path.setAttribute('fill', 'none');
        if (this.directed) path.setAttribute('marker-end', 'url(#ll-arrow)');
        group.appendChild(path);
    }

    _bindNodeDrag(g, nd, svg, NS, nodeRects, edgeGroup, dims) {
        g.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rect   = svg.getBoundingClientRect();
            const vb     = svg.viewBox.baseVal;
            const scaleX = vb.width  / rect.width;
            const scaleY = vb.height / rect.height;
            const ox = nd.x, oy = nd.y;
            const sx = e.clientX, sy = e.clientY;
            const onMove = (me) => {
                nd.x = ox + (me.clientX - sx) * scaleX;
                nd.y = oy + (me.clientY - sy) * scaleY;
                const nr = nodeRects.get(nd.id);
                if (nr) { nr.x = nd.x - dims.w / 2; nr.y = nd.y - dims.h / 2; nr.cx = nd.x; nr.cy = nd.y; }
                g.setAttribute('transform', `translate(${nd.x - dims.w / 2},${nd.y - dims.h / 2})`);
                edgeGroup.innerHTML = '';
                this._drawAllEdges(NS, edgeGroup, nodeRects);
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',  onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    /** Returns the desired content size for Manager when sizing the block. */
    getDesiredSize() {
        return { w: this._desiredW || 300, h: this._desiredH || 200 };
    }

    /** No-op: the SVG scales automatically via viewBox + 100% width/height. */
    onContainerResize(_w, _h) {}
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('LinkedList', LinkedListVisualizer);
}
