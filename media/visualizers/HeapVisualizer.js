// @ts-nocheck
console.log('[YTP] HeapVisualizer.js loaded');

class HeapVisualizer extends GraphBaseVisualizer {
    constructor(container) {
        super(container);

        // ── state ──────────────────────────────────────────────────────────
        this.variable    = null;
        this.base        = 0;       // 0 or 1 – heap base indexing
        this.limit       = null;    // null = show all
        this.indexLabel  = 'index'; // 'index' | 'name'
        this.dataFields  = [];      // {fieldName, nickname}[]
        this.nameField   = '';      // field to display as node name/label
        this.directed    = true;    // heap edges are parent→child

        // ── internal ───────────────────────────────────────────────────────
        this._svgEl       = null;
        this._edgeGroupEl = null;
        this._nodeMap     = new Map();

        this._toolbar    = this._buildToolbar();
        this._advancedUI = this._buildAdvancedUI();
    }

    getToolbar() { return this._toolbar; }
    getAdvancedSettingsUI() { return this._advancedUI; }

    getParams() {
        return {
            base:       this.base,
            limit:      this.limit,
            indexLabel: this.indexLabel,
            dataFields: this.dataFields.map(d => ({ fieldName: d.fieldName, nickname: d.nickname })),
            nameField:  this.nameField
        };
    }

    setParams({ base, limit, indexLabel, dataFields, nameField } = {}) {
        if (base !== undefined) {
            this.base = base ? 1 : 0;
            this._syncBaseBtn();
        }
        if (limit !== undefined) {
            this.limit = limit === null ? null : Math.max(0, parseInt(limit) || 0);
            if (this._limitInput) this._limitInput.value = this.limit === null ? '' : this.limit;
        }
        if (indexLabel !== undefined) {
            this.indexLabel = indexLabel;
            this._syncIndexLabelBtn();
        }
        if (dataFields !== undefined) {
            this.dataFields = Array.isArray(dataFields)
                ? dataFields.map(d => typeof d === 'string' ? { fieldName: d, nickname: '' } : { fieldName: d.fieldName || '', nickname: d.nickname || '' })
                : [];
            this._syncAdvancedUI();
        }
        if (nameField !== undefined) {
            this.nameField = nameField || '';
            if (this._nameFieldInput) this._nameFieldInput.value = this.nameField;
        }
    }

    // ── Toolbar (Basic Settings) ──────────────────────────────────────────

    _buildToolbar() {
        const toolbar = document.createElement('div');

        // Base toggle (0 or 1)
        const baseGroup = document.createElement('div');
        baseGroup.className = 'viz-control';
        const baseSpan = document.createElement('span');
        baseSpan.className = 'viz-ctrl-label';
        baseSpan.textContent = 'Base: ';
        this._baseBtn = document.createElement('button');
        this._baseBtn.className = 'viz-toggle';
        this._baseBtn.addEventListener('mousedown', e => e.stopPropagation());
        this._baseBtn.addEventListener('click', () => {
            this.base = this.base === 0 ? 1 : 0;
            this._syncBaseBtn();
            this._refresh();
        });
        this._syncBaseBtn();
        baseGroup.appendChild(baseSpan);
        baseGroup.appendChild(this._baseBtn);
        toolbar.appendChild(baseGroup);

        // Limit
        const limitGroup = document.createElement('div');
        limitGroup.className = 'viz-control';
        const limitSpan = document.createElement('span');
        limitSpan.className = 'viz-ctrl-label';
        limitSpan.textContent = 'Limit: ';
        this._limitInput = document.createElement('input');
        this._limitInput.type = 'number';
        this._limitInput.placeholder = 'all';
        this._limitInput.className = 'viz-input';
        this._limitInput.addEventListener('mousedown', e => e.stopPropagation());
        this._limitInput.addEventListener('change', e => {
            this.limit = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
            this._refresh();
        });
        limitGroup.appendChild(limitSpan);
        limitGroup.appendChild(this._limitInput);
        toolbar.appendChild(limitGroup);

        return toolbar;
    }

    _syncBaseBtn() {
        if (!this._baseBtn) return;
        this._baseBtn.textContent = this.base === 0 ? '0-based' : '1-based';
        this._baseBtn.classList.toggle('viz-toggle--active', this.base === 1);
    }

    _syncIndexLabelBtn() {
        if (!this._indexLabelBtn) return;
        this._indexLabelBtn.textContent = this.indexLabel === 'index' ? 'Index' : 'Name';
        this._indexLabelBtn.classList.toggle('viz-toggle--active', this.indexLabel === 'name');
    }

    // ── Advanced Settings ──────────────────────────────────────────────────

    _buildAdvancedUI() {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '4px';

        // Data Fields
        const header = document.createElement('div');
        header.className = 'modifier-section-header';
        header.textContent = 'Data Fields';
        wrap.appendChild(header);

        this._advFieldsContainer = document.createElement('div');
        this._advFieldsContainer.className = 'viz-ll-rows';
        wrap.appendChild(this._advFieldsContainer);

        const addBtn = document.createElement('button');
        addBtn.className = 'viz-ll-add-btn';
        addBtn.textContent = '+ Add data field';
        addBtn.addEventListener('mousedown', e => e.stopPropagation());
        addBtn.addEventListener('click', () => {
            this.dataFields.push({ fieldName: '', nickname: '' });
            this._syncAdvancedUI();
        });
        wrap.appendChild(addBtn);

        this._syncAdvancedUI();
        return wrap;
    }

    _syncAdvancedUI() {
        if (!this._advFieldsContainer) return;
        if (typeof CustomDropdown !== 'undefined') CustomDropdown.detachAll(this._advFieldsContainer);
        this._advFieldsContainer.innerHTML = '';
        this.dataFields.forEach((df, idx) => {
            const row = document.createElement('div');
            row.className = 'viz-ll-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'viz-input';
            input.placeholder = 'field name';
            input.value = df.fieldName;
            if (typeof CustomDropdown !== 'undefined') {
                CustomDropdown.attach(input, () => this._getAvailableFieldNames());
            }
            input.addEventListener('mousedown', e => e.stopPropagation());
            input.addEventListener('change', e => {
                this.dataFields[idx].fieldName = e.target.value.trim();
                this._refresh();
            });
            const nickInput = document.createElement('input');
            nickInput.type = 'text';
            nickInput.className = 'viz-input viz-ll-nick-input';
            nickInput.placeholder = 'nickname (opt.)';
            nickInput.value = df.nickname;
            nickInput.addEventListener('mousedown', e => e.stopPropagation());
            nickInput.addEventListener('change', e => {
                this.dataFields[idx].nickname = e.target.value.trim();
                this._refresh();
            });
            const removeBtn = document.createElement('button');
            removeBtn.className = 'viz-ll-remove-btn';
            removeBtn.textContent = '\u00d7';
            removeBtn.addEventListener('mousedown', e => e.stopPropagation());
            removeBtn.addEventListener('click', () => {
                this.dataFields.splice(idx, 1);
                this._syncAdvancedUI();
                this._refresh();
            });
            row.appendChild(input);
            row.appendChild(nickInput);
            row.appendChild(removeBtn);
            this._advFieldsContainer.appendChild(row);
        });
        this._ensureAdvDatalist();
    }

    _getAvailableFieldNames() {
        if (!this.variable || !this.variable.children) return [];
        const allNames = new Set();
        for (const child of this.variable.children) {
            if (child.children) {
                this._collectFieldPaths(child, '', allNames);
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

    _ensureAdvDatalist() {
        // Attach custom dropdown to nameField input if present
        if (this._nameFieldInput && typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(this._nameFieldInput, () => this._getAvailableFieldNames());
            CustomDropdown.updateOptions(this._nameFieldInput, () => this._getAvailableFieldNames());
        }
    }

    // ── Update ─────────────────────────────────────────────────────────────

    update(variable) {
        this.variable = variable;
        this._syncAdvancedUI();
        this._refresh();
    }

    _refresh() {
        const { nodes, edges } = this._parseHeap();
        this._nodes = nodes;
        this._edges = edges;
        this._applyLayout();
        this._renderHeap();
    }

    // ── Parsing ────────────────────────────────────────────────────────────

    _parseHeap() {
        if (!this.variable || !this.variable.children) return { nodes: [], edges: [] };
        const ch = this.variable.children;
        if (ch.length === 0) return { nodes: [], edges: [] };

        const total = ch.length;
        const start = Math.min(Math.max(0, this.base), total - 1);
        const end = this.limit === null
            ? total - 1
            : Math.min(Math.max(0, this.limit), total - 1);
        if (end < start) return { nodes: [], edges: [] };

        const valid = new Set();
        for (let i = start; i <= end; i++) valid.add(i);

        const nodes = [];
        const edges = [];

        for (let i = start; i <= end; i++) {
            nodes.push({ id: i, x: undefined, y: undefined });

            let left, right;
            if (this.base === 0) {
                left  = 2 * i + 1;
                right = 2 * i + 2;
            } else {
                left  = 2 * i;
                right = 2 * i + 1;
            }
            if (valid.has(left))  edges.push({ from: i, to: left });
            if (valid.has(right)) edges.push({ from: i, to: right });
        }

        return { nodes, edges };
    }

    // ── Layout ─────────────────────────────────────────────────────────────

    _applyLayout() {
        if (this._nodes.length === 0) return;
        const nodeById = new Map(this._nodes.map(n => [n.id, n]));
        const root = this.base === 1 ? 1 : 0;

        // Compute depth of tree
        const n = this._nodes.length;
        const lastId = this._nodes[n - 1].id;
        let maxDepth = 0;
        {
            let id = lastId;
            while (id > root) {
                id = this.base === 0 ? Math.floor((id - 1) / 2) : Math.floor(id / 2);
                maxDepth++;
            }
        }

        const hSpacing = 55;  // horizontal distance between nodes at the deepest level
        const vSpacing = 65;  // vertical distance between layers

        // Position nodes top-down: root at center, children offset from parent
        // At depth d, the horizontal offset from parent is hSpacing * 2^(maxDepth - d - 1)
        const depthOf = (id) => {
            let d = 0, cur = id;
            while (cur > root) {
                cur = this.base === 0 ? Math.floor((cur - 1) / 2) : Math.floor(cur / 2);
                d++;
            }
            return d;
        };

        const w = Math.max((Math.pow(2, maxDepth) + 1) * hSpacing, 280);
        const h = Math.max((maxDepth + 2) * vSpacing, 220);

        // Place root
        const rootNode = nodeById.get(root);
        if (rootNode) {
            rootNode.x = w / 2;
            rootNode.y = vSpacing;
        }

        // BFS to place children relative to parent
        const queue = [root];
        let qi = 0;
        while (qi < queue.length) {
            const pid = queue[qi++];
            const parent = nodeById.get(pid);
            if (!parent) continue;
            const pDepth = depthOf(pid);

            let leftId, rightId;
            if (this.base === 0) {
                leftId  = 2 * pid + 1;
                rightId = 2 * pid + 2;
            } else {
                leftId  = 2 * pid;
                rightId = 2 * pid + 1;
            }

            const offset = hSpacing * Math.pow(2, maxDepth - pDepth - 1);

            const leftNode = nodeById.get(leftId);
            if (leftNode) {
                leftNode.x = parent.x - offset;
                leftNode.y = parent.y + vSpacing;
                queue.push(leftId);
            }
            const rightNode = nodeById.get(rightId);
            if (rightNode) {
                rightNode.x = parent.x + offset;
                rightNode.y = parent.y + vSpacing;
                queue.push(rightId);
            }
        }

        this._heapW = w;
        this._heapH = h;
    }

    // ── Rendering ──────────────────────────────────────────────────────────

    _renderHeap() {
        this._svgContainer.innerHTML = '';
        this._nodeMap.clear();
        this._elements = [];

        if (this._nodes.length === 0) {
            const msg = document.createElement('span');
            msg.className = 'viz-array-empty';
            msg.textContent = this.variable ? '(empty heap)' : 'No data';
            this._svgContainer.appendChild(msg);
            return;
        }

        const NS = 'http://www.w3.org/2000/svg';
        const NODE_R = 22;
        const ch = this.variable.children;

        const nodeExtents = this._nodes.map(nd => ({
            x: nd.x, y: nd.y, halfW: NODE_R, halfH: NODE_R
        }));
        const vb = this._computeTightViewBox(nodeExtents);

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `${vb.vbX} ${vb.vbY} ${vb.vbW} ${vb.vbH}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'viz-graph-svg');
        this._svgEl = svg;

        const defs = document.createElementNS(NS, 'defs');
        svg.appendChild(defs);

        // Edges
        this._edgeGroupEl = document.createElementNS(NS, 'g');
        const nodeMap = new Map(this._nodes.map(n => [n.id, n]));
        for (const edge of this._edges) {
            const src = nodeMap.get(edge.from);
            const tgt = nodeMap.get(edge.to);
            if (!src || !tgt) continue;
            const dx = tgt.x - src.x, dy = tgt.y - src.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len, ny = dy / len;
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', src.x + nx * NODE_R);
            line.setAttribute('y1', src.y + ny * NODE_R);
            line.setAttribute('x2', tgt.x - nx * NODE_R);
            line.setAttribute('y2', tgt.y - ny * NODE_R);
            line.setAttribute('class', 'viz-graph-edge');
            this._edgeGroupEl.appendChild(line);
        }
        svg.appendChild(this._edgeGroupEl);

        // Nodes
        const nodeGroup = document.createElementNS(NS, 'g');
        const activeFields = this.dataFields.filter(f => f.fieldName);
        for (let ni = 0; ni < this._nodes.length; ni++) {
            const nd = this._nodes[ni];
            const child = ch[nd.id];
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'viz-graph-node');
            g.setAttribute('transform', `translate(${nd.x},${nd.y})`);

            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('r', NODE_R);

            // Node label: show VALUE as primary, index as secondary
            let label;
            if (this.nameField && child) {
                const v = this._resolveFieldValue(child, this.nameField);
                label = v !== undefined ? String(v) : (child ? child.value : String(nd.id));
            } else if (child) {
                label = child.value;
            } else {
                label = String(nd.id);
            }

            // Value text (data fields override)
            let valueText = '';
            if (activeFields.length > 0 && child && child.children) {
                const parts = [];
                for (const df of activeFields) {
                    const val = this._resolveFieldValue(child, df.fieldName);
                    const displayName = df.nickname || df.fieldName;
                    if (activeFields.length === 1) {
                        parts.push(val !== undefined ? String(val) : 'NaN');
                    } else {
                        parts.push(val !== undefined ? `${displayName}:${val}` : `${displayName}:NaN`);
                    }
                }
                valueText = parts.join(', ');
            }

            // Render label + value
            const text = document.createElementNS(NS, 'text');
            text.setAttribute('text-anchor', 'middle');
            // Display: if data fields override, show label above + fields below;
            // otherwise just show the value (label) centered
            const displayText = valueText || label;
            if (valueText && valueText !== label) {
                text.setAttribute('dominant-baseline', 'auto');
                text.setAttribute('y', '-4');
                text.textContent = label;

                const valText = document.createElementNS(NS, 'text');
                valText.setAttribute('text-anchor', 'middle');
                valText.setAttribute('dominant-baseline', 'hanging');
                valText.setAttribute('y', '4');
                valText.setAttribute('class', 'viz-graph-node-data');
                valText.textContent = valueText;
                g.appendChild(valText);
            } else {
                text.setAttribute('dominant-baseline', 'central');
                text.textContent = displayText;
            }

            g.appendChild(circle);
            g.appendChild(text);
            nodeGroup.appendChild(g);

            this._nodeMap.set(nd.id, { node: nd, g });
            this._elements.push({
                index: ni, domRef: g, text: displayText,
                rect: { x: nd.x - NODE_R, y: nd.y - NODE_R, w: NODE_R * 2, h: NODE_R * 2 }
            });
        }
        svg.appendChild(nodeGroup);
        this._svgContainer.appendChild(svg);

        this._resizeBlock(vb.vbW, vb.vbH);
        this.fitSvg();
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('heap', HeapVisualizer);
}
