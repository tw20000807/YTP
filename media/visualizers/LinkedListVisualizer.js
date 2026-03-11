// @ts-nocheck
console.log('[YTP] LinkedListVisualizer.js loaded');

class LinkedListVisualizer extends GraphBaseVisualizer {
    constructor(container) {
        super(container);

        // ── state ──────────────────────────────────────────────────────────────
        this.variable   = null;
        this.dataFields = [];          // string[]   – names of fields to show as node data
        this.pointers   = [];          // {fieldName, nickname}[] – pointer/edge fields
        this.layout     = 'auto';     // 'auto' | 'snake' | 'layer'
        this.directed   = true;

        // ── graph data ─────────────────────────────────────────────────────────
        this._nodeIndexById = new Map();
        // (_nodes, _edges, _svgContainer inherited from GraphBaseVisualizer)

        this._toolbar = this._buildToolbar();
        this._advancedUI = this._buildAdvancedUI();
    }

    getToolbar() { return this._toolbar; }

    getParams() {
        return {
            dataFields: this.dataFields.slice(),
            pointers:   this.pointers.map(p => ({ fieldName: p.fieldName, nickname: p.nickname })),
            layout:     this.layout,
            directed:   this.directed
        };
    }

    setParams({ dataFields, pointers, layout, directed } = {}) {
        if (dataFields !== undefined) {
            this.dataFields = Array.isArray(dataFields) ? dataFields.slice() : [];
            this._syncDataFieldsUI();
        }
        if (pointers !== undefined) {
            this.pointers = Array.isArray(pointers) ? pointers.map(p => ({ fieldName: p.fieldName || '', nickname: p.nickname || '' })) : [];
            this._syncPointersUI();
        }
        if (layout    !== undefined && layout    !== null) { this.layout    = layout;    if (this._layoutSel) this._layoutSel.value = layout; }
        if (directed  !== undefined && directed  !== null) { this.directed  = directed;  this._syncDirBtn(); }
    }

    dispose() {}

    // ── Toolbar (Basic Settings) ───────────────────────────────────────────────

    _buildToolbar() {
        const tb = document.createElement('div');

        // ── Direction toggle ──
        const dirGroup = document.createElement('div');
        dirGroup.className = 'viz-control';
        const dirLabel = document.createElement('label');
        dirLabel.textContent = 'Direction: ';
        this._dirBtn = document.createElement('button');
        this._dirBtn.className = 'viz-toggle';
        this._dirBtn.addEventListener('mousedown', e => e.stopPropagation());
        this._dirBtn.addEventListener('click', () => {
            this.directed = !this.directed;
            this._syncDirBtn();
            this._refresh();
        });
        this._syncDirBtn();
        dirLabel.appendChild(this._dirBtn);
        dirGroup.appendChild(dirLabel);

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

        // ── Direction toggle (appended last: data, pointers, direction) ──
        tb.appendChild(dirGroup);

        return tb;
    }

    _buildAdvancedUI() {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '4px';

        // ── Layout selector ──
        const layoutGroup = document.createElement('div');
        layoutGroup.className = 'viz-control';
        const layoutLabel = document.createElement('label');
        layoutLabel.textContent = 'Layout: ';
        this._layoutSel = document.createElement('select');
        this._layoutSel.className = 'viz-select';
        ['auto', 'snake', 'layer'].forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === this.layout) opt.selected = true;
            this._layoutSel.appendChild(opt);
        });
        this._layoutSel.addEventListener('mousedown', e => e.stopPropagation());
        this._layoutSel.addEventListener('change', e => {
            this.layout = e.target.value;
            this._refresh();
        });
        layoutLabel.appendChild(this._layoutSel);
        layoutGroup.appendChild(layoutLabel);
        wrap.appendChild(layoutGroup);

        return wrap;
    }

    getAdvancedSettingsUI() {
        return this._advancedUI;
    }

    _syncDirBtn() {
        if (!this._dirBtn) return;
        this._dirBtn.textContent = this.directed ? 'Directed' : 'Undirected';
        this._dirBtn.classList.toggle('viz-toggle--active', !!this.directed);
    }

    /**
     * Recursively collect all variable paths under the current node.
     * Traverses all nodes in the linked list (union).
     * Path format: p1/p2/name1 (array indices excluded from path).
     * @returns {string[]} field path names
     */
    _getAvailableFieldNames() {
        if (!this.variable) return [];
        const allNames = new Set();
        const nodeType = this.variable.type;
        const visited = new Set();

        const collectFromNode = (varData) => {
            const id = varData.name || '';
            if (visited.has(id)) return;
            visited.add(id);
            if (varData.children) {
                this._collectFieldPaths(varData, '', nodeType, allNames);
            }
            // Follow pointer fields to collect from other nodes (union)
            if (varData.children) {
                for (const child of varData.children) {
                    if (this._isPointerToNodeType(child.type, nodeType) &&
                        child.children && child.children.length > 0) {
                        collectFromNode(child);
                    }
                }
            }
        };

        collectFromNode(this.variable);
        return [...allNames];
    }

    /**
     * Recursively collect field paths from a variable's children.
     */
    _collectFieldPaths(varData, prefix, nodeType, names) {
        if (!varData || !varData.children) return;
        for (const child of varData.children) {
            const leaf = this._leafName(child.name);
            if (/^\[\d+\]$/.test(leaf)) {
                if (child.children) this._collectFieldPaths(child, prefix, nodeType, names);
                continue;
            }
            const fullPath = prefix ? `${prefix}/${leaf}` : leaf;
            names.add(fullPath);
            if (this._isPointerToNodeType(child.type, nodeType)) continue;
            if (child.children && child.children.length > 0) {
                this._collectFieldPaths(child, fullPath, nodeType, names);
            }
        }
    }

    /**
     * Check if a child's type refers back to the linked-list node type.
     */
    _isPointerToNodeType(childType, nodeType) {
        if (!childType || !nodeType) return false;
        const normalize = (t) => t.replace(/\b(const|volatile|struct|class|enum)\b/g, '')
                                  .replace(/[*&\s]/g, '');
        const a = normalize(childType);
        const b = normalize(nodeType);
        return a === b && a !== '';
    }

    /**
     * Resolve a slash-separated field path to a value from a variable node.
     * Transparently traverses through array indices.
     */
    _resolveFieldValue(varData, fieldPath) {
        const parts = fieldPath.split('/');
        let current = varData;
        for (const part of parts) {
            if (!current || !current.children) return undefined;
            let child = current.children.find(c => this._leafName(c.name) === part);
            if (!child) {
                for (const c of current.children) {
                    if (/^\[\d+\]$/.test(this._leafName(c.name)) && c.children) {
                        child = c.children.find(gc => this._leafName(gc.name) === part);
                        if (child) break;
                    }
                }
            }
            if (!child) return undefined;
            current = child;
        }
        return current ? current.value : undefined;
    }

    /**
     * Resolve a slash-separated field path to a child variable node.
     * Used for following pointer fields.
     */
    _resolvePointerChild(varData, fieldPath) {
        const parts = fieldPath.split('/');
        let current = varData;
        for (const part of parts) {
            if (!current || !current.children) return null;
            let child = current.children.find(c => this._leafName(c.name) === part);
            if (!child) {
                for (const c of current.children) {
                    if (/^\[\d+\]$/.test(this._leafName(c.name)) && c.children) {
                        child = c.children.find(gc => this._leafName(gc.name) === part);
                        if (child) break;
                    }
                }
            }
            if (!child) return null;
            current = child;
        }
        return current;
    }

    /**
     * Auto-detect data fields and pointer fields using type heuristic.
     * Only runs when both dataFields and pointers are empty (first time).
     */
    _autoDetectFields() {
        if (!this.variable || !this.variable.children) return;
        if (this.dataFields.length > 0 || this.pointers.length > 0) return;
        const nodeType = this.variable.type;
        const data = [];
        const ptrs = [];
        this._classifyFields(this.variable, '', nodeType, data, ptrs);
        this.dataFields = data;
        this.pointers = ptrs.map(p => ({ fieldName: p, nickname: '' }));
        this._syncDataFieldsUI();
        this._syncPointersUI();
    }

    /**
     * Recursively classify fields as data or pointer.
     */
    _classifyFields(varData, prefix, nodeType, dataList, ptrList) {
        if (!varData || !varData.children) return;
        for (const child of varData.children) {
            const leaf = this._leafName(child.name);
            if (/^\[\d+\]$/.test(leaf)) {
                if (child.children) this._classifyFields(child, prefix, nodeType, dataList, ptrList);
                continue;
            }
            const fullPath = prefix ? `${prefix}/${leaf}` : leaf;
            if (this._isPointerToNodeType(child.type, nodeType)) {
                ptrList.push(fullPath);
                continue;
            }
            if (!child.children || child.children.length === 0) {
                dataList.push(fullPath);
            } else {
                this._classifyFields(child, fullPath, nodeType, dataList, ptrList);
            }
        }
    }

    /**
     * Create or update a shared <datalist> element attached to the toolbar
     * with current available field names.
     * @returns {string} the datalist element's id
     */
    _ensureFieldDatalist() {
        // No-op: custom dropdown is attached inline in _mkDataFieldRow / _mkPointerRow.
        return '';
    }

    _syncDataFieldsUI() {
        if (!this._dataFieldsContainer) return;
        if (typeof CustomDropdown !== 'undefined') CustomDropdown.detachAll(this._dataFieldsContainer);
        this._dataFieldsContainer.innerHTML = '';
        this.dataFields.forEach((name, idx) => {
            const row = this._mkDataFieldRow(name, idx);
            this._dataFieldsContainer.appendChild(row);
        });
    }

    _syncPointersUI() {
        if (!this._pointersContainer) return;
        if (typeof CustomDropdown !== 'undefined') CustomDropdown.detachAll(this._pointersContainer);
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
        if (typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(input, () => this._getAvailableFieldNames());
        }
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
        const wrapper = document.createElement('div');
        wrapper.className = 'viz-ll-row-group';

        const topRow = document.createElement('div');
        topRow.className = 'viz-ll-row';

        const fieldInput = document.createElement('input');
        fieldInput.type = 'text';
        fieldInput.className = 'viz-ll-input';
        fieldInput.placeholder = 'field name';
        fieldInput.value = ptr.fieldName;
        if (typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(fieldInput, () => this._getAvailableFieldNames());
        }
        fieldInput.addEventListener('mousedown', e => e.stopPropagation());
        fieldInput.addEventListener('change', e => {
            this.pointers[idx].fieldName = e.target.value.trim();
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

        topRow.appendChild(fieldInput);
        topRow.appendChild(removeBtn);

        const nickRow = document.createElement('div');
        nickRow.className = 'viz-ll-row';
        const nickInput = document.createElement('input');
        nickInput.type = 'text';
        nickInput.className = 'viz-ll-input';
        nickInput.placeholder = 'nickname (opt.)';
        nickInput.value = ptr.nickname;
        nickInput.addEventListener('mousedown', e => e.stopPropagation());
        nickInput.addEventListener('change', e => {
            this.pointers[idx].nickname = e.target.value.trim();
            this._refresh();
        });
        nickRow.appendChild(nickInput);

        wrapper.appendChild(topRow);
        wrapper.appendChild(nickRow);
        return wrapper;
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    update(variable) {
        this.variable = variable;
        // Auto-detect data/pointer fields on first update if none configured
        this._autoDetectFields();
        // Refresh auto-complete suggestions whenever the variable data changes
        this._ensureFieldDatalist();
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

        const dataFields = this.dataFields.filter(f => f);
        const ptrList = this.pointers.filter(p => p.fieldName);
        const ptrMap = new Map(ptrList.map(p => [p.fieldName, p.nickname]));

        const traverse = (varData, nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const nodeData = [];
            nodes.push({ id: nodeId, x: undefined, y: undefined, data: nodeData });

            if (!varData.children) return;

            // Resolve data fields by path
            for (const fieldPath of dataFields) {
                const value = this._resolveFieldValue(varData, fieldPath);
                nodeData.push({ name: fieldPath, value: value !== undefined ? String(value) : 'NaN' });
            }

            // Follow pointer fields by path
            for (const [ptrPath, nickname] of ptrMap) {
                const ptrChild = this._resolvePointerChild(varData, ptrPath);
                if (ptrChild && ptrChild.children && ptrChild.children.length > 0) {
                    const childId = ptrChild.name;
                    edges.push({ from: nodeId, to: childId, label: nickname || '' });
                    if (!visited.has(childId)) traverse(ptrChild, childId);
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

    _getEffectiveLayout() {
        if (this.layout === 'auto') {
            const ptrCount = this.pointers.filter(p => p.fieldName).length;
            return ptrCount >= 2 ? 'layer' : 'snake';
        }
        return this.layout;
    }

    _canvasSize() {
        const n = Math.max(this._nodes.length, 1);
        const effective = this._getEffectiveLayout();
        if (effective === 'snake') {
            // Snake: compute cols for a reasonable aspect ratio
            const sampleDims = this._nodes.length > 0 ? this._nodeDims(this._nodes[0]) : { w: 100, h: 22 };
            const nodeW = sampleDims.w;
            const nodeH = sampleDims.h;
            const hGap = 40;  // horizontal gap between nodes
            const vGap = 50;  // vertical gap between rows (includes U-turn space)
            const cols = Math.max(1, Math.ceil(Math.sqrt(n * (nodeW + hGap) / (nodeH + vGap))));
            const rows = Math.ceil(n / cols);
            const w = cols * (nodeW + hGap) + hGap;
            const h = rows * (nodeH + vGap) + vGap;
            return { w: Math.max(w, 300), h: Math.max(h, 100) };
        }
        // layer (or fallback)
        const byLayer = this._computeLayers();
        const numL = byLayer.size;
        const maxPer = Math.max(...[...byLayer.values()].map(a => a.length), 1);
        return { w: Math.max((numL + 1) * 140, 300), h: Math.max((maxPer + 1) * 90, 240) };
    }

    _applyLayout() {
        if (this._nodes.length === 0) return;
        const { w, h } = this._canvasSize();
        const effective = this._getEffectiveLayout();
        if (effective === 'snake') {
            this._layoutSnake(w, h);
        } else {
            this._layoutLayer(w, h);
        }
    }

    // _layoutCircle inherited from GraphBaseVisualizer

    _computeLayers() {
        const nodeKeys = this._nodes.map((_, i) => i);
        const idToIdx = this._nodeIndexById;
        // Map edges from node IDs to indices for BFS
        const indexEdges = this._edges
            .map(e => ({ from: idToIdx.get(e.from), to: idToIdx.get(e.to) }))
            .filter(e => e.from !== undefined && e.to !== undefined);
        return this._computeLayersBFS(nodeKeys, indexEdges, null);
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
        super._layoutSpring(w, h, 150, 60);
    }

    /**
     * Snake layout: nodes arranged left-to-right in rows, wrapping to next row.
     * Edges between same-row consecutive nodes are straight arrows.
     * The wrap edge (last in row → first in next row) uses a U-shaped path
     * routed outside the node area so it doesn't cross any nodes.
     */
    _layoutSnake(canvasW, canvasH) {
        const n = this._nodes.length;
        if (n === 0) return;

        const sampleDims = this._nodeDims(this._nodes[0]);
        const nodeW = sampleDims.w;
        const nodeH = sampleDims.h;
        const hGap = 40;
        const vGap = 50;

        const cols = Math.max(1, Math.ceil(Math.sqrt(n * (nodeW + hGap) / (nodeH + vGap))));

        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / cols);
            const colInRow = i % cols;
            // All rows go left-to-right
            const col = colInRow;
            const nd = this._nodes[i];
            nd.x = (col + 0.5) * (nodeW + hGap) + hGap / 2;
            nd.y = (row + 0.5) * (nodeH + vGap) + vGap / 2;
        }
        // Store cols for U-turn edge drawing
        this._snakeCols = cols;
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

        // Compute tight viewBox from actual node positions + rect dimensions
        const nodeExtents = this._nodes.map(nd => {
            const dims = this._nodeDims(nd);
            return { x: nd.x, y: nd.y, halfW: dims.w / 2, halfH: dims.h / 2 };
        });
        const vb = this._computeTightViewBox(nodeExtents);

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `${vb.vbX} ${vb.vbY} ${vb.vbW} ${vb.vbH}`);
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
        this._elements = [];
        for (let ni = 0; ni < this._nodes.length; ni++) {
            const nd = this._nodes[ni];
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

            this._elements.push({
                index: ni, domRef: g, text: this._leafName(nd.id),
                rect: { x: nx, y: ny, w: dims.w, h: dims.h }
            });

            // Node drag
            this._bindNodeDrag(g, nd, svg, NS, nodeRects, edgeGroup, dims);
        }

        // Draw edges
        this._drawAllEdges(NS, edgeGroup, nodeRects);

        this._svgContainer.appendChild(svg);

        // Store desired content size via base class (tight viewBox dimensions)
        this._resizeBlock(vb.vbW, vb.vbH);

        // Apply robust BBox fitting
        this.fitSvg();
    }

    // _mkArrow inherited from GraphBaseVisualizer

    _drawAllEdges(NS, group, nodeRects) {
        // Snake layout: use specialised straight + U-turn drawing
        if (this._getEffectiveLayout() === 'snake' && this._snakeCols) {
            this._drawSnakeEdges(NS, group, nodeRects);
            return;
        }

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

    /**
     * Draw edges for snake layout:
     * - Same-row consecutive nodes: straight horizontal arrow
     * - Row-wrap (last in row i → first in row i+1): U-turn path routed
     *   outside the node area, going right-side → down → left-side.
     */
    _drawSnakeEdges(NS, group, nodeRects) {
        const cols = this._snakeCols;
        const idToIdx = this._nodeIndexById;

        for (const edge of this._edges) {
            const src = nodeRects.get(edge.from);
            const tgt = nodeRects.get(edge.to);
            if (!src || !tgt) continue;

            const srcIdx = idToIdx.get(edge.from);
            const tgtIdx = idToIdx.get(edge.to);
            if (srcIdx === undefined || tgtIdx === undefined) continue;

            const srcRow = Math.floor(srcIdx / cols);
            const tgtRow = Math.floor(tgtIdx / cols);

            if (srcRow === tgtRow) {
                // Same row: straight horizontal arrow from right edge of src to left edge of tgt
                const x1 = src.x + src.w;
                const y1 = src.y + src.h / 2;
                const x2 = tgt.x;
                const y2 = tgt.y + tgt.h / 2;
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                line.setAttribute('class', 'viz-graph-edge');
                if (this.directed) line.setAttribute('marker-end', 'url(#ll-arrow)');
                group.appendChild(line);
            } else {
                // Row wrap: U-turn path
                // Route: right of src → down outside → left to reach tgt
                const gap = 20; // clearance outside nodes
                // Start: right edge of src, vertical center
                const x1 = src.x + src.w;
                const y1 = src.y + src.h / 2;
                // End: left edge of tgt, vertical center
                const x4 = tgt.x;
                const y4 = tgt.y + tgt.h / 2;

                // Find the rightmost x among all nodes to route the U-turn outside
                let maxRight = 0;
                for (const [, r] of nodeRects) {
                    maxRight = Math.max(maxRight, r.x + r.w);
                }
                const turnX = maxRight + gap;

                // Midpoint Y between the two rows
                const midY = (src.y + src.h + tgt.y) / 2;

                // Find the leftmost x among all nodes
                let minLeft = Infinity;
                for (const [, r] of nodeRects) {
                    minLeft = Math.min(minLeft, r.x);
                }
                const leftX = minLeft - gap;

                // Path: right → turn right → down to midY → left across → down to tgt row → right to tgt
                const d = `M ${x1} ${y1} L ${turnX} ${y1} L ${turnX} ${midY} L ${leftX} ${midY} L ${leftX} ${y4} L ${x4} ${y4}`;

                const path = document.createElementNS(NS, 'path');
                path.setAttribute('d', d);
                path.setAttribute('class', 'viz-graph-edge');
                path.setAttribute('fill', 'none');
                if (this.directed) path.setAttribute('marker-end', 'url(#ll-arrow)');
                group.appendChild(path);
            }

            if (edge.label) {
                const mx = (src.cx + tgt.cx) / 2;
                const my = (src.cy + tgt.cy) / 2;
                const lbl = document.createElementNS(NS, 'text');
                lbl.setAttribute('x', mx); lbl.setAttribute('y', my);
                lbl.setAttribute('class', 'viz-graph-edge-label');
                lbl.setAttribute('text-anchor', 'middle');
                lbl.setAttribute('dominant-baseline', 'central');
                lbl.textContent = edge.label;
                group.appendChild(lbl);
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
        const p1 = this._rectBorderPoint(src, tgt.cx, tgt.cy);
        const p2 = this._rectBorderPoint(tgt, src.cx, src.cy);

        if (curveDir === 0) {
            // Straight line for non-bidirectional edges
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
            line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
            line.setAttribute('class', 'viz-graph-edge');
            if (withArrow) line.setAttribute('marker-end', 'url(#ll-arrow)');
            group.appendChild(line);
        } else {
            // Curved path for bidirectional edges
            const curvature = 45;
            const sign = curveDir === -1 ? -1 : 1;
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
        }

        if (edge.label) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('x', mx); lbl.setAttribute('y', my);
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

    // getDesiredSize, onContainerResize inherited from GraphBaseVisualizer
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('LinkedList', LinkedListVisualizer);
}
