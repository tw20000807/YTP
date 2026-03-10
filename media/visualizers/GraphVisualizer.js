// @ts-nocheck
console.log('[YTP] GraphVisualizer.js loaded');

class GraphVisualizer extends GraphBaseVisualizer {
    constructor(container) {
        super(container);

        // ── state ────────────────────────────────────────────────────────────
        this.variable    = null;
        this.base        = 0;
        this.limit       = null;   // null = show all (inclusive end index)
        this.format      = null;   // 'adj_matrix' | 'adj_list' | 'next' | 'edge_list'
        this.directed    = null;   // null = auto-detect on first update
        this.layout      = 'circle'; // 'spring' | 'circle' | 'layer' | 'chain'
        this.weights     = 'none'; // 'none' | 'weighted'
        this.layerRoot   = null;   // null = auto (in-degree 0); number = fixed BFS root
        this.reverseEdges = false;  // when true, mirror every edge A→B as B→A
        this._nodeLayerMap = null;  // Map<nodeId, layerIndex> – populated by _layoutLayer
        this.nextField     = '';    // optional: struct field name for "next" (edge target)
        this.weightField   = '';    // optional: struct field name for edge weight
        this.edgeListFrom  = '';    // edge_list: field for 'from' (u)
        this.edgeListTo    = '';    // edge_list: field for 'to' (v)
        this.edgeListWeight = '';   // edge_list: field for weight (w)

        // ── graph data ───────────────────────────────────────────────────────
        this._rawEdges = []; // parsed edges before mode-based expansion
        this._addedNodeIds = new Set();
        this._addedRawEdgeKeys = new Set();

        // ── DOM ──────────────────────────────────────────────────────────────
        // (SVG container inherited from GraphBaseVisualizer)

        // ── SVG element refs (populated by _renderGraph) ─────────────────────
        this._svgEl       = null;
        this._edgeGroupEl = null;
        this._nodeMap     = new Map(); // id -> {node, g}

        this._toolbar = this._buildToolbar();
        this._advancedUI = this._buildAdvancedUI();
    }

    getToolbar() { return this._toolbar; }

    /** Return all toolbar states for persistence. Does NOT render. */
    getParams() {
        return {
            base:         this.base,
            limit:        this.limit,
            format:       this.format,
            layout:       this.layout,
            directed:     this.directed,
            reverseEdges: this.reverseEdges,
            layerRoot:    this.layerRoot,
            weights:      this.weights,
            nextField:      this.nextField,
            weightField:    this.weightField,
            edgeListFrom:   this.edgeListFrom,
            edgeListTo:     this.edgeListTo,
            edgeListWeight: this.edgeListWeight
        };
    }

    /** Restore toolbar states. Does NOT render — caller invokes update() afterwards. */
    setParams({ base, limit, format, directed, layout, weights, layerRoot, reverseEdges, nodeDataField, dataFields, nextField, nextNickname, weightField, weightNickname, edgeListFrom, edgeListTo, edgeListWeight } = {}) {
        if (base         !== undefined) { this.base    = Math.max(0, parseInt(base) || 0); if (this._baseInput)  this._baseInput.value  = this.base  || ''; }
        if (limit        !== undefined) { this.limit   = limit === null ? null : Math.max(0, parseInt(limit) || 0); if (this._limitInput) this._limitInput.value = this.limit === null ? '' : this.limit; }
        if (format       !== undefined && format   !== null) { this.format   = format;   if (this._formatSel)  this._formatSel.value  = format;  }
        if (directed     !== undefined && directed !== null) { this.directed = directed; this._syncDirBtn(); }
        if (layout       !== undefined && layout   !== null) { this.layout   = layout;   if (this._layoutSel)  this._layoutSel.value  = layout; }
        if (weights      !== undefined && weights  !== null) { this.weights  = weights;  if (this._weightsSel) this._weightsSel.value = weights; }
        if (layerRoot    !== undefined)                      { this.layerRoot = layerRoot === null ? null : parseInt(layerRoot); if (this._rootInput) this._rootInput.value = this.layerRoot === null ? '' : this.layerRoot; }
        if (reverseEdges !== undefined)                      { this.reverseEdges = !!reverseEdges; this._syncRevBtn(); }
        // Legacy compat: convert old dataFields/nodeDataField to nextField
        if (nodeDataField !== undefined && nextField === undefined) {
            this.nextField = nodeDataField || '';
            if (this._nextFieldInput) this._nextFieldInput.value = this.nextField;
        }
        if (dataFields !== undefined && nextField === undefined) {
            const arr = Array.isArray(dataFields) ? dataFields : [];
            const first = arr[0];
            this.nextField = first ? (typeof first === 'string' ? first : first.fieldName || '') : '';
            if (this._nextFieldInput) this._nextFieldInput.value = this.nextField;
        }
        if (nextField    !== undefined)                      { this.nextField = nextField || ''; if (this._nextFieldInput) this._nextFieldInput.value = this.nextField; }
        if (weightField   !== undefined)                     { this.weightField = weightField || ''; if (this._weightFieldInput) this._weightFieldInput.value = this.weightField; }
        if (edgeListFrom  !== undefined)                     { this.edgeListFrom = edgeListFrom || ''; if (this._edgeListFromInput) this._edgeListFromInput.value = this.edgeListFrom; }
        if (edgeListTo    !== undefined)                     { this.edgeListTo = edgeListTo || ''; if (this._edgeListToInput) this._edgeListToInput.value = this.edgeListTo; }
        if (edgeListWeight!== undefined)                     { this.edgeListWeight = edgeListWeight || ''; if (this._edgeListWeightInput) this._edgeListWeightInput.value = this.edgeListWeight; }
        this._showHideLayout();
    }

    // ── Toolbar ───────────────────────────────────────────────────────────────

    _buildToolbar() {
        const toolbar = document.createElement('div');

        // Base
        this._baseInput = this._mkNumInput(toolbar, 'Base', '0', (v) => {
            this.base = v === '' ? 0 : Math.max(0, parseInt(v) || 0);
            this._refresh();
        });

        // Limit
        this._limitInput = this._mkNumInput(toolbar, 'Limit', '', (v) => {
            this.limit = v === '' ? null : Math.max(0, parseInt(v) || 0);
            this._refresh();
        });

        // Format
        this._formatSel = this._mkSelect(toolbar, 'Format',
            ['adj_matrix', 'adj_list', 'next', 'edge_list'], (v) => {
                this.format = v;
                this._showHideLayout();
                this._refresh();
            });

        // Directed toggle
        const dirGroup = document.createElement('div');
        dirGroup.className = 'viz-control';
        const dirSpan = document.createElement('span');
        dirSpan.className = 'viz-ctrl-label';
        dirSpan.textContent = 'Direction: ';
        this._dirBtn = document.createElement('button');
        this._dirBtn.className = 'viz-toggle';
        this._dirBtn.addEventListener('mousedown', e => e.stopPropagation());
        this._dirBtn.addEventListener('click', () => {
            this.directed = !this.directed;
            this._syncDirBtn();
            // On undirected + layer layout, initialize root to 0 if not set
            if (!this.directed && this.layout === 'layer' && this.layerRoot === null) {
                this.layerRoot = 0;
                if (this._rootInput) this._rootInput.value = '0';
            }
            this._refresh();
        });
        this._syncDirBtn();
        dirGroup.appendChild(dirSpan);
        dirGroup.appendChild(this._dirBtn);
        toolbar.appendChild(dirGroup);

        // Layout
        this._layoutWrap = document.createElement('div');
        this._layoutWrap.className = 'viz-toolbar-wrap';
        // 'spring'=force-directed, 'circle'=ring, 'layer'=BFS layers, 'chain'=linear next
        this._layoutSel = this._mkSelect(this._layoutWrap, 'Layout',
            ['circle', 'layer', 'chain', 'spring'], (v) => {
                this.layout = v;
                // When switching to layer on undirected graph, default root to 0
                if (v === 'layer' && !this.directed && this.layerRoot === null) {
                    this.layerRoot = 0;
                    if (this._rootInput) this._rootInput.value = '0';
                }
                this._showHideLayout();
                this._applyLayout();
                this._renderGraph();
            });
        toolbar.appendChild(this._layoutWrap);

        return toolbar;
    }

    _buildAdvancedUI() {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '6px';

        // Root (visible only when layout === 'layer')
        this._rootWrap = document.createElement('div');
        this._rootWrap.className = 'viz-toolbar-wrap viz-toolbar-hidden';
        this._rootInput = this._mkNumInput(this._rootWrap, 'Root', '', (v) => {
            this.layerRoot = v === '' ? null : parseInt(v);
            this._applyLayout();
            this._renderGraph();
        });
        this._rootInput.placeholder = 'auto';
        wrap.appendChild(this._rootWrap);

        // Weights
        this._weightsSel = this._mkSelect(wrap, 'Weights', ['none', 'weighted'], (v) => {
            this.weights = v;
            this._refresh();
        });
        this._weightsWrap = this._weightsSel.closest('.viz-control');

        // Reverse edges toggle
        const revGroup = document.createElement('div');
        revGroup.className = 'viz-control';
        this._revWrap = revGroup;
        const revSpan = document.createElement('span');
        revSpan.className = 'viz-ctrl-label';
        revSpan.textContent = 'Rev.Edges: ';
        this._revBtn = document.createElement('button');
        this._revBtn.className = 'viz-toggle';
        this._revBtn.addEventListener('mousedown', e => e.stopPropagation());
        this._revBtn.addEventListener('click', () => {
            this.reverseEdges = !this.reverseEdges;
            this._syncRevBtn();
            this._refresh();
        });
        this._syncRevBtn();
        revGroup.appendChild(revSpan);
        revGroup.appendChild(this._revBtn);
        wrap.appendChild(revGroup);

        // Next field (determines which child variable is the "next"/target for adj_list and next formats)
        const dataSection = document.createElement('div');
        dataSection.className = 'viz-ll-section';
        this._dataSection = dataSection;
        const dataSectionLabel = document.createElement('div');
        dataSectionLabel.className = 'viz-ll-section-title';
        dataSectionLabel.textContent = 'Next:';
        dataSection.appendChild(dataSectionLabel);
        const nextGroup = document.createElement('div');
        nextGroup.className = 'viz-ll-row';
        this._nextFieldInput = document.createElement('input');
        this._nextFieldInput.type = 'text';
        this._nextFieldInput.className = 'viz-ll-input';
        this._nextFieldInput.placeholder = '(auto)';
        this._nextFieldInput.value = this.nextField;
        this._nextFieldInput.addEventListener('mousedown', e => e.stopPropagation());
        this._nextFieldInput.addEventListener('change', e => {
            this.nextField = e.target.value.trim();
            this._refresh();
        });
        nextGroup.appendChild(this._nextFieldInput);
        dataSection.appendChild(nextGroup);
        wrap.appendChild(dataSection);

        // Edge weight field
        const weightSection = document.createElement('div');
        weightSection.className = 'viz-ll-section';
        this._weightSection = weightSection;
        const weightSectionLabel = document.createElement('div');
        weightSectionLabel.className = 'viz-ll-section-title';
        weightSectionLabel.textContent = 'Weight:';
        weightSection.appendChild(weightSectionLabel);
        const weightGroup = document.createElement('div');
        weightGroup.className = 'viz-ll-row';
        this._weightFieldInput = document.createElement('input');
        this._weightFieldInput.type = 'text';
        this._weightFieldInput.className = 'viz-ll-input';
        this._weightFieldInput.placeholder = '(auto)';
        this._weightFieldInput.value = this.weightField;
        // datalist attribute set dynamically by _ensureNodeFieldDatalist()
        this._weightFieldInput.addEventListener('mousedown', e => e.stopPropagation());
        this._weightFieldInput.addEventListener('change', e => {
            this.weightField = e.target.value.trim();
            this._refresh();
        });
        weightGroup.appendChild(this._weightFieldInput);
        weightSection.appendChild(weightGroup);
        wrap.appendChild(weightSection);

        // ── Edge-list specific fields ────────────────────────────────────────
        const edgeListSection = document.createElement('div');
        edgeListSection.className = 'viz-ll-section';
        this._edgeListSection = edgeListSection;
        const elSectionLabel = document.createElement('div');
        elSectionLabel.className = 'viz-ll-section-title';
        elSectionLabel.textContent = 'Edge List Fields:';
        edgeListSection.appendChild(elSectionLabel);

        // From (u)
        const fromRow = document.createElement('div');
        fromRow.className = 'viz-ll-row';
        const fromLabel = document.createElement('span');
        fromLabel.className = 'viz-ctrl-label';
        fromLabel.textContent = 'from (u): ';
        fromLabel.style.fontSize = '0.85em';
        fromLabel.style.minWidth = '52px';
        this._edgeListFromInput = document.createElement('input');
        this._edgeListFromInput.type = 'text';
        this._edgeListFromInput.className = 'viz-ll-input';
        this._edgeListFromInput.placeholder = '(auto: 1st)';
        this._edgeListFromInput.value = this.edgeListFrom;
        this._edgeListFromInput.addEventListener('mousedown', e => e.stopPropagation());
        this._edgeListFromInput.addEventListener('change', e => {
            this.edgeListFrom = e.target.value.trim();
            this._refresh();
        });
        fromRow.appendChild(fromLabel);
        fromRow.appendChild(this._edgeListFromInput);
        edgeListSection.appendChild(fromRow);

        // To (v)
        const toRow = document.createElement('div');
        toRow.className = 'viz-ll-row';
        const toLabel = document.createElement('span');
        toLabel.className = 'viz-ctrl-label';
        toLabel.textContent = 'to (v): ';
        toLabel.style.fontSize = '0.85em';
        toLabel.style.minWidth = '52px';
        this._edgeListToInput = document.createElement('input');
        this._edgeListToInput.type = 'text';
        this._edgeListToInput.className = 'viz-ll-input';
        this._edgeListToInput.placeholder = '(auto: 2nd)';
        this._edgeListToInput.value = this.edgeListTo;
        this._edgeListToInput.addEventListener('mousedown', e => e.stopPropagation());
        this._edgeListToInput.addEventListener('change', e => {
            this.edgeListTo = e.target.value.trim();
            this._refresh();
        });
        toRow.appendChild(toLabel);
        toRow.appendChild(this._edgeListToInput);
        edgeListSection.appendChild(toRow);

        // Weight (w) for edge_list
        const elWeightRow = document.createElement('div');
        elWeightRow.className = 'viz-ll-row';
        const elWeightLabel = document.createElement('span');
        elWeightLabel.className = 'viz-ctrl-label';
        elWeightLabel.textContent = 'weight (w): ';
        elWeightLabel.style.fontSize = '0.85em';
        elWeightLabel.style.minWidth = '52px';
        this._edgeListWeightInput = document.createElement('input');
        this._edgeListWeightInput.type = 'text';
        this._edgeListWeightInput.className = 'viz-ll-input';
        this._edgeListWeightInput.placeholder = '(auto: 3rd)';
        this._edgeListWeightInput.value = this.edgeListWeight;
        this._edgeListWeightInput.addEventListener('mousedown', e => e.stopPropagation());
        this._edgeListWeightInput.addEventListener('change', e => {
            this.edgeListWeight = e.target.value.trim();
            this._refresh();
        });
        elWeightRow.appendChild(elWeightLabel);
        elWeightRow.appendChild(this._edgeListWeightInput);
        edgeListSection.appendChild(elWeightRow);

        wrap.appendChild(edgeListSection);

        return wrap;
    }

    _mkNumInput(parent, label, placeholder, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-control';
        const span = document.createElement('span');
        span.className = 'viz-ctrl-label';
        span.textContent = label + ': ';
        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.className = 'viz-input';
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('change', e => onChange(e.target.value));
        group.appendChild(span);
        group.appendChild(input);
        parent.appendChild(group);
        return input;
    }

    _mkSelect(parent, label, options, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-control';
        const span = document.createElement('span');
        span.className = 'viz-ctrl-label';
        span.textContent = label + ': ';
        const sel = document.createElement('select');
        sel.className = 'viz-select';
        options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            sel.appendChild(opt);
        });
        sel.addEventListener('mousedown', e => e.stopPropagation());
        sel.addEventListener('change', e => onChange(e.target.value));
        group.appendChild(span);
        group.appendChild(sel);
        parent.appendChild(group);
        return sel;
    }

    _syncDirBtn() {
        this._dirBtn.textContent = this.directed ? 'Directed' : 'Undirected';
        this._dirBtn.classList.toggle('viz-toggle--active', !!this.directed);
    }

    _syncRevBtn() {
        if (!this._revBtn) return;
        this._revBtn.textContent = this.reverseEdges ? 'Yes' : 'No';
        this._revBtn.classList.toggle('viz-toggle--active', !!this.reverseEdges);
    }

    getAdvancedSettingsUI() {
        return this._advancedUI;
    }

    _showHideLayout() {
        // Show root input only when layout === 'layer'
        if (this._rootWrap) {
            this._rootWrap.classList.toggle('viz-toolbar-hidden', this.layout !== 'layer');
        }
        // Hide all advanced settings for adj_matrix
        const isMatrix = this.format === 'adj_matrix';
        const isEdgeList = this.format === 'edge_list';
        // Weights dropdown is always visible (adj_matrix cell values ARE weights)
        if (this._revWrap)       this._revWrap.classList.toggle('viz-toolbar-hidden', isMatrix);
        // Next/Weight sections: shown for adj_list/next only
        if (this._dataSection)   this._dataSection.classList.toggle('viz-toolbar-hidden', isMatrix || isEdgeList);
        if (this._weightSection) this._weightSection.classList.toggle('viz-toolbar-hidden', isMatrix || isEdgeList);
        // Edge-list section: shown only for edge_list format
        if (this._edgeListSection) this._edgeListSection.classList.toggle('viz-toolbar-hidden', !isEdgeList);
    }

    // ── Autocomplete helpers ──────────────────────────────────────────────────────

    _getAvailableNodeFieldNames() {
        if (!this.variable || !this.variable.children) return [];
        const allNames = new Set();
        const children = this.variable.children;
        const start = Math.min(Math.max(0, this.base), children.length - 1);
        const end = this.limit === null ? children.length - 1 : Math.min(Math.max(0, this.limit), children.length - 1);
        for (let i = start; i <= end; i++) {
            if (!children[i].children) continue;
            if (this.format === 'adj_list') {
                for (const sub of children[i].children) {
                    if (sub.children) {
                        this._collectFieldPaths(sub, '', allNames);
                    }
                }
            } else if (this.format === 'edge_list') {
                // For edge_list: collect from each edge element's children
                this._collectFieldPaths(children[i], '', allNames);
            } else if (this.format !== 'adj_matrix') {
                this._collectFieldPaths(children[i], '', allNames);
            }
        }
        return [...allNames];
    }

    _collectFieldPaths(varData, prefix, names) {
        if (!varData || !varData.children) return;
        for (const child of varData.children) {
            const leaf = this._leafName(child.name);
            if (/^\[\d+\]$/.test(leaf)) {
                if (child.children) this._collectFieldPaths(child, prefix, names);
                continue;
            }
            const fullPath = prefix ? `${prefix}/${leaf}` : leaf;
            names.add(fullPath);
            if (child.children && child.children.length > 0) {
                this._collectFieldPaths(child, fullPath, names);
            }
        }
    }

    _leafName(name) {
        const parts = (name || '').split(/->|\./);
        for (let i = parts.length - 1; i >= 0; i--) {
            const s = parts[i].trim();
            if (s) return s;
        }
        return name || '';
    }

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

    _ensureNodeFieldDatalist() {
        const names = this._getAvailableNodeFieldNames();
        const getOpts = () => names;
        const inputs = [
            this._nextFieldInput, this._weightFieldInput,
            this._edgeListFromInput, this._edgeListToInput, this._edgeListWeightInput
        ];
        for (const inp of inputs) {
            if (!inp) continue;
            if (typeof CustomDropdown !== 'undefined') {
                CustomDropdown.attach(inp, getOpts);
                CustomDropdown.updateOptions(inp, getOpts);
            }
        }
    }

    // ── Update entry point ────────────────────────────────────────────────────

    update(variable) {
        const prevSnapshot = this._computeRawSnapshot(this.variable);
        const currSnapshot = this._computeRawSnapshot(variable);

        if (this.variable) {
            const prevNodes = new Set(prevSnapshot.nodes.map(n => n.id));
            this._addedNodeIds = new Set(currSnapshot.nodes.map(n => n.id).filter(id => !prevNodes.has(id)));
            const prevEdges = new Set(prevSnapshot.edges.map(e => `${e.from},${e.to}`));
            this._addedRawEdgeKeys = new Set(
                currSnapshot.edges
                    .map(e => `${e.from},${e.to}`)
                    .filter(k => !prevEdges.has(k))
            );
        } else {
            this._addedNodeIds = new Set();
            this._addedRawEdgeKeys = new Set();
        }

        this.variable = variable;

        // Auto-detect format and direction only on the very first call.
        // On subsequent updates keep the user's (or auto-detected) settings.
        const isFirstCall = this.format === null;
        if (isFirstCall) {
            const fmt = this._detectFormat(variable);
            this.format = fmt;
            this._formatSel.value = fmt;
            // Default to 'chain' layout for next-pointer arrays
            if (fmt === 'next') {
                this.layout = 'chain';
                if (this._layoutSel) this._layoutSel.value = 'chain';
            }
            // Auto-detect weighted adj_matrix (values beyond 0/1)
            if (fmt === 'adj_matrix' && this._detectWeightedMatrix(variable)) {
                this.weights = 'weighted';
                if (this._weightsSel) this._weightsSel.value = 'weighted';
            }
            this._showHideLayout();
        }

        // Refresh autocomplete datalists (after format is known)
        this._ensureNodeFieldDatalist();

        this._refresh(isFirstCall);
    }

    _computeRawSnapshot(variable) {
        if (!variable || !variable.children) return { nodes: [], edges: [] };

        let format = this.format;
        if (format === null || format === undefined) {
            format = this._detectFormat(variable);
        }

        const children = variable.children;
        if (children.length === 0) return { nodes: [], edges: [] };

        const start = Math.min(Math.max(0, this.base), children.length - 1);
        const end = this.limit === null
            ? children.length - 1
            : Math.min(Math.max(0, this.limit), children.length - 1);
        if (end < start) return { nodes: [], edges: [] };

        const valid = new Set();
        for (let i = start; i <= end; i++) valid.add(i);

        const nodes = [];
        for (let i = start; i <= end; i++) nodes.push({ id: i });

        const edges = [];
        if (format === 'next') {
            for (let i = start; i <= end; i++) {
                const to = parseInt(children[i].value);
                if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight: null });
            }
        } else if (format === 'adj_list') {
            for (let i = start; i <= end; i++) {
                const subs = children[i].children || [];
                for (let j = 0; j < subs.length; j++) {
                    const nb = subs[j];
                    let to;
                    if (this.nextField) {
                        const val = this._resolveFieldValue(nb, this.nextField);
                        to = val !== undefined ? parseInt(val) : NaN;
                    } else {
                        to = parseInt(nb.value);
                    }
                    let weight = null;
                    if (this.weightField) {
                        const wv = this._resolveFieldValue(nb, this.weightField);
                        weight = wv !== undefined ? wv : null;
                    }
                    if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight });
                }
            }
        } else if (format === 'edge_list') {
            return this._parseEdgeListSnapshot(children, start, end);
        } else {
            for (let i = start; i <= end; i++) {
                const row = children[i].children || [];
                for (let j = start; j <= end; j++) {
                    if (j < row.length) {
                        const v = row[j].value;
                        if (v !== '0' && v !== '') edges.push({ from: i, to: j, weight: v });
                    }
                }
            }
        }

        return { nodes, edges };
    }

    /** Parse an edge-list array: each element is (u, v) or (u, v, w). */
    _parseEdgeListSnapshot(children, start, end) {
        const nodeSet = new Set();
        const edges = [];
        for (let i = start; i <= end; i++) {
            const entry = children[i];
            const subs = entry.children || [];
            let u, v, w = null;
            if (this.edgeListFrom) {
                const val = this._resolveFieldValue(entry, this.edgeListFrom);
                u = val !== undefined ? parseInt(val) : NaN;
            } else {
                u = subs.length > 0 ? parseInt(subs[0].value) : NaN;
            }
            if (this.edgeListTo) {
                const val = this._resolveFieldValue(entry, this.edgeListTo);
                v = val !== undefined ? parseInt(val) : NaN;
            } else {
                v = subs.length > 1 ? parseInt(subs[1].value) : NaN;
            }
            if (this.weights === 'weighted') {
                if (this.edgeListWeight) {
                    const val = this._resolveFieldValue(entry, this.edgeListWeight);
                    w = val !== undefined ? val : null;
                } else {
                    w = subs.length > 2 ? subs[2].value : null;
                }
            }
            if (!isNaN(u) && !isNaN(v)) {
                nodeSet.add(u);
                nodeSet.add(v);
                edges.push({ from: u, to: v, weight: w });
            }
        }
        const nodes = [...nodeSet].sort((a, b) => a - b).map(id => ({ id }));
        return { nodes, edges };
    }

    _refresh(detectDirection = false) {
        const { nodes, edges } = this._parseGraph();
        this._nodes = nodes;
        this._rawEdges = edges;

        if (detectDirection || this.directed === null) {
            this.directed = this._detectDirected(edges); // use original parsed edges
            this._syncDirBtn();
        }

        this._edges = this._buildStoredEdges(this._rawEdges);

        this._applyLayout();
        this._renderGraph();
    }

    _buildStoredEdges(baseEdges) {
        const parsed = [...baseEdges];

        // reverseEdges in directed mode: show/store reversed edges only.
        if (this.directed && this.reverseEdges) {
            return parsed.map(e => ({ from: e.to, to: e.from, weight: e.weight }));
        }

        // undirected mode: show/store both directions.
        if (!this.directed) {
            const stored = [...parsed];
            const existing = new Set(stored.map(e => `${e.from},${e.to}`));
            const toAdd = [];
            for (const e of stored) {
                const reverseKey = `${e.to},${e.from}`;
                if (!existing.has(reverseKey)) {
                    toAdd.push({ from: e.to, to: e.from, weight: e.weight });
                    existing.add(reverseKey);
                }
            }
            return [...stored, ...toAdd];
        }

        return parsed;
    }

    // ── Format / direction auto-detection ─────────────────────────────────────

    _detectFormat(variable) {
        // if (!variable || !variable.children || variable.children.length === 0) return 'adj_list';
        const ch = variable.children;
        const hasGrand = ch.some(c => c.children && c.children.length > 0);
        if (!hasGrand) return 'next';
        const outerLen = ch.length;
        const allSquare = ch.every(c => c.children && c.children.length === outerLen);
        return allSquare ? 'adj_matrix' : 'adj_list';
    }

    _detectDirected(edges) {
        const s = new Set(edges.map(e => `${e.from},${e.to}`));
        for (const e of edges) {
            if (!s.has(`${e.to},${e.from}`)) return true;
        }
        return false;
    }

    /** Returns true if any adj_matrix cell value is something other than '0' or '1'. */
    _detectWeightedMatrix(variable) {
        if (!variable || !variable.children) return false;
        for (const row of variable.children) {
            if (!row.children) continue;
            for (const cell of row.children) {
                const v = cell.value;
                if (v !== '0' && v !== '1' && v !== '') return true;
            }
        }
        return false;
    }

    // ── Parsing ───────────────────────────────────────────────────────────────

    _parseGraph() {
        if (!this.variable || !this.variable.children) return { nodes: [], edges: [] };
        const ch = this.variable.children;
        if (ch.length === 0) return { nodes: [], edges: [] };
        const start = Math.min(Math.max(0, this.base), ch.length - 1);
        const end = this.limit === null
            ? ch.length - 1
            : Math.min(Math.max(0, this.limit), ch.length - 1);
        if (end < start) return { nodes: [], edges: [] };

        const valid = new Set();
        for (let i = start; i <= end; i++) valid.add(i);

        const nodes = [];
        for (let i = start; i <= end; i++) nodes.push({ id: i, x: undefined, y: undefined });

        const edges = [];

        if (this.format === 'next') {
            for (let i = start; i <= end; i++) {
                const to = parseInt(ch[i].value);
                if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight: null });
            }
        } else if (this.format === 'adj_list') {
            for (let i = start; i <= end; i++) {
                const subs = ch[i].children || [];
                for (let j = 0; j < subs.length; j++) {
                    const nb = subs[j];
                    let to;
                    if (this.nextField) {
                        const val = this._resolveFieldValue(nb, this.nextField);
                        to = val !== undefined ? parseInt(val) : NaN;
                    } else {
                        to = parseInt(nb.value);
                    }
                    let weight = null;
                    if (this.weightField) {
                        const wv = this._resolveFieldValue(nb, this.weightField);
                        weight = wv !== undefined ? wv : null;
                    }
                    if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight });
                }
            }
        } else if (this.format === 'edge_list') {
            const result = this._parseEdgeListSnapshot(ch, start, end);
            // Add x, y to nodes for layout
            result.nodes = result.nodes.map(n => ({ id: n.id, x: undefined, y: undefined }));
            return result;
        } else { // adj_matrix
            for (let i = start; i <= end; i++) {
                const row = ch[i].children || [];
                for (let j = start; j <= end; j++) {
                    if (j < row.length) {
                        const v = row[j].value;
                        if (v !== '0' && v !== '') edges.push({ from: i, to: j, weight: v });
                    }
                }
            }
        }

        return { nodes, edges };
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    _applyLayout() {
        if (this._nodes.length === 0) return;
        const { w, h } = this._canvasSize();

        if (this.layout === 'chain') {
            this._layoutChain(w, h);
        } else if (this.layout === 'circle') {
            this._layoutCircle(w, h);
        } else if (this.layout === 'layer') {
            this._layoutLayer(w, h);
        } else {
            this._layoutSpring(w, h);
        }
    }

    // Compute canvas dimensions from node count so every node fits
    _canvasSize() {
        const n = Math.max(this._nodes.length, 1);
        const spacing = 65;
        if (this.layout === 'chain') {
            const ARC_STEP = 32;
            let maxGap = 0;
            for (const e of this._edges) maxGap = Math.max(maxGap, Math.abs(e.to - e.from));
            const nodeRow   = 50;
            const arcClear  = maxGap * ARC_STEP + 20;
            const w = Math.max(n * spacing + 60, 280);
            const h = Math.max(arcClear + nodeRow + 20, 150);
            return { w, h };
        }
        if (this.layout === 'circle') {
            const r    = Math.max((spacing * n) / (2 * Math.PI), 70);
            const side = Math.ceil(r * 2 + 60);
            return { w: Math.max(side, 280), h: Math.max(side, 220) };
        }
        if (this.layout === 'layer') {
            const byLayer      = this._computeLayers();
            const numLayers    = byLayer.size;
            const maxPerLayer  = Math.max(...[...byLayer.values()].map(a => a.length), 1);
            return {
                w: Math.max((maxPerLayer + 1) * 80,  280),
                h: Math.max((numLayers + 1) * 65, 220)
            };
        }
        // spring
        const side = Math.max(Math.ceil(Math.sqrt(n)) * spacing + 60, 280);
        return { w: side, h: Math.max(Math.ceil(side * 0.75), 220) };
    }

    _layoutChain(w, h) {
        const n       = this._nodes.length;
        const spacing = Math.min(65, (w - 60) / Math.max(1, n - 1));
        const totalW  = spacing * (n - 1);
        const ox      = (w - totalW) / 2;
        const nodeY   = h - 50;
        this._nodes.forEach((nd, i) => { nd.x = ox + i * spacing; nd.y = nodeY; });
    }

    // _layoutCircle inherited from GraphBaseVisualizer

    // BFS-based layer assignment; returns Map<layerIndex, nodeId[]>
    _computeLayers() {
        const nodeKeys = this._nodes.map(n => n.id);
        return this._computeLayersBFS(nodeKeys, this._edges, this.layerRoot);
    }

    _layoutLayer(w, h) {
        const byLayer  = this._computeLayers();
        const nodeById = new Map(this._nodes.map(n => [n.id, n]));
        const nLayers  = byLayer.size;
        const lSpacing = h / (nLayers + 1);
        // Store node→layer mapping so _redrawEdges can detect tree vs same-layer edges
        this._nodeLayerMap = new Map();
        byLayer.forEach((ids, l) => {
            const nSpacing = w / (ids.length + 1);
            ids.forEach((id, i) => {
                const nd = nodeById.get(id);
                if (nd) { nd.x = (i + 1) * nSpacing; nd.y = (l + 1) * lSpacing; }
                this._nodeLayerMap.set(id, l);
            });
        });
    }

    // Fruchterman-Reingold spring simulation via base class
    _layoutSpring(w, h) {
        super._layoutSpring(w, h, 200, 28);
    }

    // ── SVG Rendering ─────────────────────────────────────────────────────────

    _renderGraph() {
        this._svgContainer.innerHTML = '';
        this._nodeMap.clear();

        if (this._nodes.length === 0) {
            const msg = document.createElement('span');
            msg.className = 'viz-array-empty';
            msg.textContent = this.variable ? '(empty graph)' : 'No data';
            this._svgContainer.appendChild(msg);
            return;
        }

        const { w, h } = this._canvasSize();
        const NS = 'http://www.w3.org/2000/svg';
        const NODE_R = 22;

        // Compute tight viewBox from actual node positions
        const nodeExtents = this._nodes.map(nd => ({
            x: nd.x, y: nd.y, halfW: NODE_R, halfH: NODE_R
        }));
        const vb = this._computeTightViewBox(nodeExtents);

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `${vb.vbX} ${vb.vbY} ${vb.vbW} ${vb.vbH}`);
        svg.setAttribute('width',  '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'viz-graph-svg');
        this._svgEl = svg;

        // Defs: arrowhead
        const defs = document.createElementNS(NS, 'defs');
        defs.appendChild(this._mkArrow(NS, 'graph-arrow', '#6e9ccf'));
        defs.appendChild(this._mkArrow(NS, 'graph-arrow-new', '#b8860b'));
        svg.appendChild(defs);

        // Edge group
        this._edgeGroupEl = document.createElementNS(NS, 'g');
        svg.appendChild(this._edgeGroupEl);
        this._redrawEdges(NS);

        // Node group
        const nodeGroup = document.createElementNS(NS, 'g');
        this._elements = [];
        for (let ni = 0; ni < this._nodes.length; ni++) {
            const nd = this._nodes[ni];
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'viz-graph-node');
            if (this._addedNodeIds.has(nd.id)) g.classList.add('viz-graph-node--new');
            g.setAttribute('transform', `translate(${nd.x},${nd.y})`);

            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('r', NODE_R);

            const text = document.createElementNS(NS, 'text');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.textContent = nd.id;

            g.appendChild(circle);
            g.appendChild(text);

            nodeGroup.appendChild(g);

            this._nodeMap.set(nd.id, { node: nd, g });
            this._bindDrag(g, nd, svg, NS);

            this._elements.push({
                index: ni, domRef: g, text: nd.id,
                rect: { x: nd.x - NODE_R, y: nd.y - NODE_R, w: NODE_R * 2, h: NODE_R * 2 }
            });
        }
        svg.appendChild(nodeGroup);
        this._svgContainer.appendChild(svg);

        // Size the parent block around the tight viewBox dimensions
        this._resizeBlock(vb.vbW, vb.vbH);

        // Apply robust BBox fitting to catch text labels or items outside estimated bounds
        this.fitSvg();
    }

    // _resizeBlock, getDesiredSize, onContainerResize inherited from GraphBaseVisualizer

    // ── Edge drawing (called on full render and on drag) ──────────────────────

    _redrawEdges(NS) {
        if (!this._edgeGroupEl) return;
        const _NS = NS || 'http://www.w3.org/2000/svg';
        this._edgeGroupEl.innerHTML = '';

        const nodeMap = new Map(this._nodes.map(n => [n.id, n]));
        const edgeSet  = new Set(this._edges.map(e => `${e.from},${e.to}`));
        const drawn    = new Set();

        // chain-format: arc drawing keyed on index position
        if (this.layout === 'chain') {
            const drawnUndirected = new Set();
            for (const edge of this._edges) {
                const edgeKey = `${edge.from},${edge.to}`;

                if (!this.directed) {
                    const pairKey = edge.from <= edge.to
                        ? `${edge.from},${edge.to}`
                        : `${edge.to},${edge.from}`;
                    if (drawnUndirected.has(pairKey)) continue;
                    drawnUndirected.add(pairKey);

                    const reverseKey = `${edge.to},${edge.from}`;
                    const isNew = this._addedRawEdgeKeys.has(edgeKey) || this._addedRawEdgeKeys.has(reverseKey);
                    this._drawChainEdge(_NS, nodeMap.get(edge.from), nodeMap.get(edge.to), edge, isNew);
                    continue;
                }

                this._drawChainEdge(_NS, nodeMap.get(edge.from), nodeMap.get(edge.to), edge, this._addedRawEdgeKeys.has(edgeKey));
            }
            return;
        }

        // Circle layout: draw only straight non-self edges (self-loops remain loops).
        if (this.layout === 'circle') {
            for (const edge of this._edges) {
                const key = `${edge.from},${edge.to}`;
                if (drawn.has(key)) continue;

                const src = nodeMap.get(edge.from);
                const tgt = nodeMap.get(edge.to);
                if (!src || !tgt) continue;

                const reverseKey = `${edge.to},${edge.from}`;
                const isBidi     = edgeSet.has(reverseKey);
                const isSelf     = edge.from === edge.to;
                const edgeIsNew = this._addedRawEdgeKeys.has(key);
                const revIsNew = this._addedRawEdgeKeys.has(reverseKey);

                if (isSelf) {
                    this._drawSelfLoop(_NS, src, edge, edgeIsNew);
                } else if (this.directed && isBidi) {
                    const rev = this._edges.find(e => e.from === edge.to && e.to === edge.from);
                    this._drawStraightEdge(_NS, src, tgt,       edge, true,  4, edgeIsNew);
                    this._drawStraightEdge(_NS, tgt, src, rev || edge, true, -4, revIsNew);
                    drawn.add(reverseKey);
                } else if (this.directed) {
                    this._drawStraightEdge(_NS, src, tgt, edge, true, 0, edgeIsNew);
                } else {
                    this._drawStraightEdge(_NS, src, tgt, edge, false, 0, edgeIsNew || revIsNew);
                    drawn.add(reverseKey);
                }

                drawn.add(key);
            }
            return;
        }

        for (const edge of this._edges) {
            const key = `${edge.from},${edge.to}`;
            if (drawn.has(key)) continue;

            const src = nodeMap.get(edge.from);
            const tgt = nodeMap.get(edge.to);
            if (!src || !tgt) continue;

            const reverseKey = `${edge.to},${edge.from}`;
            const isBidi     = edgeSet.has(reverseKey);
            const isSelf     = edge.from === edge.to;
            const edgeIsNew = this._addedRawEdgeKeys.has(key);
            const revIsNew = this._addedRawEdgeKeys.has(reverseKey);

            // Layer layout: tree-edges (cross-layer) straight; same-layer edges curved.
            const useStraight = this.layout === 'layer' && this._edgeIsTreeEdge(edge);

            if (isSelf) {
                this._drawSelfLoop(_NS, src, edge, edgeIsNew);
            } else if (this.directed && isBidi) {
                const rev = this._edges.find(e => e.from === edge.to && e.to === edge.from);
                if (useStraight) {
                    this._drawStraightEdge(_NS, src, tgt,       edge, true,  4, edgeIsNew);
                    this._drawStraightEdge(_NS, tgt, src, rev || edge, true, -4, revIsNew);
                } else {
                    this._drawCurvedEdge(_NS, src, tgt,  1, edge, true, this.layout === 'layer' ? 52 : null, edgeIsNew);
                    this._drawCurvedEdge(_NS, tgt, src, -1, rev || edge, true, this.layout === 'layer' ? 52 : null, revIsNew);
                }
                drawn.add(reverseKey);
            } else if (this.directed) {
                if (useStraight) {
                    this._drawStraightEdge(_NS, src, tgt, edge, true, 0, edgeIsNew);
                } else {
                    this._drawCurvedEdge(_NS, src, tgt, 0, edge, true, this.layout === 'layer' ? 34 : null, edgeIsNew);
                }
            } else {
                if (useStraight) {
                    this._drawStraightEdge(_NS, src, tgt, edge, false, 0, edgeIsNew || revIsNew);
                } else {
                    this._drawCurvedEdge(_NS, src, tgt, 0, edge, false, this.layout === 'layer' ? 34 : null, edgeIsNew || revIsNew);
                }
                drawn.add(reverseKey);
            }
            drawn.add(key);
        }
    }

    /** Returns true when an edge connects nodes in different BFS layers (tree edge). */
    _edgeIsTreeEdge(edge) {
        if (!this._nodeLayerMap) return true;
        return this._nodeLayerMap.get(edge.from) !== this._nodeLayerMap.get(edge.to);
    }

    // Chain arc edge: straight for gap=1, upward quadratic arc for gap>1.
    // Arc height = gap * ARC_STEP so longer jumps never cross shorter ones.
    _drawChainEdge(NS, src, tgt, edge, isNew = false) {
        if (!src || !tgt) return;
        const R        = 22;
        const ARC_STEP = 32; // must match _canvasSize
        const gap      = Math.abs(tgt.id - src.id);
        const withArrow = this.directed;

        if (gap <= 1) {
            // Straight horizontal line between node edges (with arrow if directed)
            this._drawStraightEdge(NS, src, tgt, edge, withArrow, 0, isNew);
            return;
        }

        // Control point directly above the midpoint, height = gap * ARC_STEP
        const cx = (src.x + tgt.x) / 2;
        const cy = src.y - gap * ARC_STEP; // upward (SVG y increases downward)

        // Shorten path start by R along tangent toward control point
        const t0x = cx - src.x, t0y = cy - src.y;
        const t0l = Math.sqrt(t0x * t0x + t0y * t0y) || 1;
        const x1  = src.x + (t0x / t0l) * R;
        const y1  = src.y + (t0y / t0l) * R;

        // Shorten path end by R along tangent from control point to target
        const t1x = tgt.x - cx, t1y = tgt.y - cy;
        const t1l = Math.sqrt(t1x * t1x + t1y * t1y) || 1;
        const x2  = tgt.x - (t1x / t1l) * R;
        const y2  = tgt.y - (t1y / t1l) * R;

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        path.setAttribute('class', 'viz-graph-edge');
        if (isNew) path.classList.add('viz-graph-edge--new');
        path.setAttribute('fill', 'none');
        if (withArrow) path.setAttribute('marker-end', isNew ? 'url(#graph-arrow-new)' : 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(path);

        if (this.weights === 'weighted' && edge.weight !== null) {
            const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
            const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
            this._drawLabel(NS, lx, ly, edge.weight);
        }
    }

    // _mkArrow inherited from GraphBaseVisualizer

    _drawStraightEdge(NS, src, tgt, edge, withArrow = false, biOffset = 0, isNew = false) {
        const R   = 22;
        const dx  = tgt.x - src.x, dy = tgt.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx  = dx / len,       ny = dy / len;
        let x1 = src.x + nx * R, y1 = src.y + ny * R;
        let x2 = tgt.x - nx * R, y2 = tgt.y - ny * R;
        // Perpendicular offset to visually separate bidirectional straight edge pairs
        if (biOffset) {
            x1 -= ny * biOffset; y1 += nx * biOffset;
            x2 -= ny * biOffset; y2 += nx * biOffset;
        }
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'viz-graph-edge');
        if (isNew) line.classList.add('viz-graph-edge--new');
        if (withArrow) line.setAttribute('marker-end', isNew ? 'url(#graph-arrow-new)' : 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(line);

        if (this.weights === 'weighted' && edge.weight !== null) {
            this._drawLabel(NS, (x1 + x2) / 2, (y1 + y2) / 2, edge.weight);
        }
    }

    /**
     * curveDir: -1 = curve right, 0 = small left curve, 1 = curve left
     */
    _drawCurvedEdge(NS, src, tgt, curveDir, edge, withArrow, curvatureOverride = null, isNew = false) {
        const R          = 22;
        const curvature  = curvatureOverride === null ? (curveDir === 0 ? 20 : 40) : curvatureOverride;
        const sign       = curveDir === -1 ? -1 : 1;
        const dx  = tgt.x - src.x, dy = tgt.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len, ny = dy / len;

        // Perpendicular offset for control point
        const cx = (src.x + tgt.x) / 2 - ny * curvature * sign;
        const cy = (src.y + tgt.y) / 2 + nx * curvature * sign;

        // Shorten start along bezier tangent at t=0 (P0→control)
        const t0x = cx - src.x, t0y = cy - src.y;
        const t0l = Math.sqrt(t0x * t0x + t0y * t0y) || 1;
        const x1 = src.x + (t0x / t0l) * R;
        const y1 = src.y + (t0y / t0l) * R;

        // Shorten end along bezier tangent at t=1 (control→P2)
        const t1x = tgt.x - cx, t1y = tgt.y - cy;
        const t1l = Math.sqrt(t1x * t1x + t1y * t1y) || 1;
        const x2 = tgt.x - (t1x / t1l) * R;
        const y2 = tgt.y - (t1y / t1l) * R;

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
        path.setAttribute('class', 'viz-graph-edge');
        if (isNew) path.classList.add('viz-graph-edge--new');
        path.setAttribute('fill', 'none');
        if (withArrow) path.setAttribute('marker-end', isNew ? 'url(#graph-arrow-new)' : 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(path);

        if (this.weights === 'weighted' && edge.weight !== null) {
            // Label at quadratic bezier midpoint (t=0.5)
            const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
            const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
            this._drawLabel(NS, lx, ly, edge.weight);
        }
    }

    _drawSelfLoop(NS, node, edge, isNew = false) {
        const R   = 22;
        const lx  = node.x - R * 0.7;
        const rx  = node.x + R * 0.7;
        const top = node.y - R - 28;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d',
            `M ${lx} ${node.y - R * 0.5} C ${lx - 28} ${top} ${rx + 28} ${top} ${rx} ${node.y - R * 0.5}`);
        path.setAttribute('class', 'viz-graph-edge');
        if (isNew) path.classList.add('viz-graph-edge--new');
        path.setAttribute('fill', 'none');
        if (this.directed) path.setAttribute('marker-end', isNew ? 'url(#graph-arrow-new)' : 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(path);

        if (this.weights === 'weighted' && edge.weight !== null) {
            this._drawLabel(NS, node.x, top - 8, edge.weight);
        }
    }

    _drawLabel(NS, x, y, text) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y);
        t.setAttribute('class', 'viz-graph-edge-label');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'central');
        t.textContent = text;
        this._edgeGroupEl.appendChild(t);
    }

    // ── Node drag ─────────────────────────────────────────────────────────────

    _bindDrag(g, node, svg, NS) {
        g.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const rect   = svg.getBoundingClientRect();
            const vb     = svg.viewBox.baseVal;
            const scaleX = vb.width  / rect.width;
            const scaleY = vb.height / rect.height;
            const ox = node.x, oy = node.y;
            const sx = e.clientX, sy = e.clientY;

            const onMove = (me) => {
                node.x = ox + (me.clientX - sx) * scaleX;
                node.y = oy + (me.clientY - sy) * scaleY;
                g.setAttribute('transform', `translate(${node.x},${node.y})`);
                this._redrawEdges(NS);
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',  onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('graph', GraphVisualizer);
}
