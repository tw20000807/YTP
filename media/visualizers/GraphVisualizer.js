// @ts-nocheck
console.log('[YTP] GraphVisualizer.js loaded');

class GraphVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);

        // ── state ────────────────────────────────────────────────────────────
        this.variable    = null;
        this.base        = 0;
        this.limit       = null;   // null = show all
        this.format      = null;   // 'adj_matrix' | 'adj_list' | 'next'
        this.directed    = null;   // null = auto-detect on first update
        this.layout      = 'spring'; // 'spring' | 'circle'
        this.weights     = 'none'; // 'none' | 'weighted'

        // ── graph data ───────────────────────────────────────────────────────
        this._nodes = [];   // [{id, x, y}]
        this._edges = [];   // [{from, to, weight}]

        // ── DOM ──────────────────────────────────────────────────────────────
        this._svgContainer = document.createElement('div');
        this._svgContainer.className = 'viz-graph-container';
        this.container.appendChild(this._svgContainer);

        // ── SVG element refs (populated by _renderGraph) ─────────────────────
        this._svgEl       = null;
        this._edgeGroupEl = null;
        this._nodeMap     = new Map(); // id -> {node, g}

        this._toolbar = this._buildToolbar();
    }

    getToolbar() { return this._toolbar; }

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
            this.limit = v === '' ? null : Math.max(1, parseInt(v) || 1);
            this._refresh();
        });

        // Format
        this._formatSel = this._mkSelect(toolbar, 'Format',
            ['adj_matrix', 'adj_list', 'next'], (v) => {
                this.format = v;
                this._showHideLayout();
                this._refresh();
            });

        // Directed toggle — wrapped in a control group so it aligns with other toolbar items
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
            this._renderGraph();
        });
        this._syncDirBtn();
        dirLabel.appendChild(this._dirBtn);
        dirGroup.appendChild(dirLabel);
        toolbar.appendChild(dirGroup);

        // Layout (hidden for 'next' format)
        this._layoutWrap = document.createElement('div');
        this._layoutWrap.style.display = 'flex';
        // 'spring' = force-directed, 'circle' = ring, 'layer' = BFS tree layers
        this._layoutSel = this._mkSelect(this._layoutWrap, 'Layout',
            ['spring', 'circle', 'layer'], (v) => {
                this.layout = v;
                this._applyLayout();
                this._renderGraph();
            });
        toolbar.appendChild(this._layoutWrap);

        // Weights
        this._mkSelect(toolbar, 'Weights', ['none', 'weighted'], (v) => {
            this.weights = v;
            this._renderGraph();
        });

        return toolbar;
    }

    _mkNumInput(parent, label, placeholder, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-array-control'; // reuse array input style
        const lbl = document.createElement('label');
        lbl.textContent = label + ': ';
        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.className = 'viz-array-input';
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('change', e => onChange(e.target.value));
        lbl.appendChild(input);
        group.appendChild(lbl);
        parent.appendChild(group);
        return input;
    }

    _mkSelect(parent, label, options, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-graph-control';
        const lbl = document.createElement('label');
        lbl.textContent = label + ': ';
        const sel = document.createElement('select');
        sel.className = 'viz-graph-select';
        options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            sel.appendChild(opt);
        });
        sel.addEventListener('mousedown', e => e.stopPropagation());
        sel.addEventListener('change', e => onChange(e.target.value));
        lbl.appendChild(sel);
        group.appendChild(lbl);
        parent.appendChild(group);
        return sel;
    }

    _syncDirBtn() {
        this._dirBtn.textContent = this.directed ? 'Directed' : 'Undirected';
        this._dirBtn.classList.toggle('viz-graph-toggle--active', !!this.directed);
    }

    _showHideLayout() {
        this._layoutWrap.style.display = this.format === 'next' ? 'none' : 'flex';
    }

    // ── Update entry point ────────────────────────────────────────────────────

    update(variable) {
        this.variable = variable;

        // Auto-detect format and direction only on the very first call.
        // On subsequent updates keep the user's (or auto-detected) settings.
        const isFirstCall = this.format === null;
        if (isFirstCall) {
            const fmt = this._detectFormat(variable);
            this.format = fmt;
            this._formatSel.value = fmt;
            this._showHideLayout();
        }

        this._refresh(isFirstCall);
    }

    _refresh(detectDirection = false) {
        const { nodes, edges } = this._parseGraph();
        this._nodes = nodes;
        this._edges = edges;

        if (detectDirection || this.directed === null) {
            this.directed = this._detectDirected(edges);
            this._syncDirBtn();
        }

        this._applyLayout();
        this._renderGraph();
    }

    // ── Format / direction auto-detection ─────────────────────────────────────

    _detectFormat(variable) {
        if (!variable || !variable.children || variable.children.length === 0) return 'adj_list';
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

    // ── Parsing ───────────────────────────────────────────────────────────────

    _parseGraph() {
        if (!this.variable || !this.variable.children) return { nodes: [], edges: [] };
        const ch = this.variable.children;
        const start = this.base;
        const end = this.limit === null ? ch.length : Math.min(ch.length, start + this.limit);

        const valid = new Set();
        for (let i = start; i < end; i++) valid.add(i);

        const nodes = [];
        for (let i = start; i < end; i++) nodes.push({ id: i, x: undefined, y: undefined });

        const edges = [];

        if (this.format === 'next') {
            for (let i = start; i < end; i++) {
                const to = parseInt(ch[i].value);
                if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight: null });
            }
        } else if (this.format === 'adj_list') {
            for (let i = start; i < end; i++) {
                for (const nb of (ch[i].children || [])) {
                    const to = parseInt(nb.value);
                    if (!isNaN(to) && valid.has(to)) edges.push({ from: i, to, weight: null });
                }
            }
        } else { // adj_matrix
            for (let i = start; i < end; i++) {
                const row = ch[i].children || [];
                for (let j = start; j < end; j++) {
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

        if (this.format === 'next') {
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
        const spacing = 90;
        if (this.format === 'next') {
            // Height must accommodate the tallest arc
            // Arc height per gap unit = ARC_STEP px; arc goes above the node row
            const ARC_STEP = 32;
            let maxGap = 0;
            for (const e of this._edges) maxGap = Math.max(maxGap, Math.abs(e.to - e.from));
            const nodeRow   = 60;  // px from bottom for node centres
            const arcClear  = maxGap * ARC_STEP + 20;
            const w = Math.max(n * spacing + 100, 400);
            const h = Math.max(arcClear + nodeRow + 20, 180);
            return { w, h };
        }
        if (this.layout === 'circle') {
            const r    = Math.max((spacing * n) / (2 * Math.PI), 100);
            const side = Math.ceil(r * 2 + 100);
            return { w: Math.max(side, 400), h: Math.max(side, 300) };
        }
        if (this.layout === 'layer') {
            const byLayer      = this._computeLayers();
            const numLayers    = byLayer.size;
            const maxPerLayer  = Math.max(...[...byLayer.values()].map(a => a.length), 1);
            return {
                w: Math.max((numLayers + 1) * 100, 400),
                h: Math.max((maxPerLayer + 1) * 80,  300)
            };
        }
        // spring
        const side = Math.max(Math.ceil(Math.sqrt(n)) * spacing + 100, 400);
        return { w: side, h: Math.max(Math.ceil(side * 0.75), 300) };
    }

    _layoutChain(w, h) {
        const n       = this._nodes.length;
        const spacing = Math.min(90, (w - 100) / Math.max(1, n - 1));
        const totalW  = spacing * (n - 1);
        const ox      = (w - totalW) / 2;
        // Place nodes near the bottom so arcs arch upward into the space above
        const nodeY   = h - 60;
        this._nodes.forEach((nd, i) => { nd.x = ox + i * spacing; nd.y = nodeY; });
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

    // BFS-based layer assignment; returns Map<layerIndex, nodeId[]>
    _computeLayers() {
        const adj   = new Map(this._nodes.map(n => [n.id, []]));
        const inDeg = new Map(this._nodes.map(n => [n.id, 0]));
        const seen  = new Set();
        for (const e of this._edges) {
            const key = `${e.from},${e.to}`;
            if (seen.has(key) || e.from === e.to) continue;
            seen.add(key);
            if (adj.has(e.from)) adj.get(e.from).push(e.to);
            if (inDeg.has(e.to)) inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
        }
        const layer = new Map();
        const roots = this._nodes
            .filter(n => (inDeg.get(n.id) || 0) === 0)
            .map(n => n.id);
        if (roots.length === 0 && this._nodes.length > 0) roots.push(this._nodes[0].id);
        const queue = roots.slice();
        roots.forEach(id => layer.set(id, 0));
        let qi = 0;
        while (qi < queue.length) {
            const id = queue[qi++];
            for (const nid of (adj.get(id) || [])) {
                if (!layer.has(nid)) {
                    layer.set(nid, layer.get(id) + 1);
                    queue.push(nid);
                }
            }
        }
        // Disconnected nodes go to the last layer + 1
        const maxL = layer.size > 0 ? Math.max(...layer.values()) : 0;
        this._nodes.forEach(n => { if (!layer.has(n.id)) layer.set(n.id, maxL + 1); });
        const byLayer = new Map();
        layer.forEach((l, id) => {
            if (!byLayer.has(l)) byLayer.set(l, []);
            byLayer.get(l).push(id);
        });
        return byLayer;
    }

    _layoutLayer(w, h) {
        const byLayer  = this._computeLayers();
        const nodeById = new Map(this._nodes.map(n => [n.id, n]));
        const nLayers  = byLayer.size;
        const lSpacing = w / (nLayers + 1);
        byLayer.forEach((ids, l) => {
            const nSpacing = h / (ids.length + 1);
            ids.forEach((id, i) => {
                const nd = nodeById.get(id);
                if (nd) { nd.x = (l + 1) * lSpacing; nd.y = (i + 1) * nSpacing; }
            });
        });
    }

    // Hand-rolled Fruchterman-Reingold spring simulation — no external dependency
    _layoutSpring(w, h) {
        const nodes = this._nodes;
        const n     = nodes.length;
        const pad   = 36;

        // Seed positions on a circle if not yet placed
        nodes.forEach((nd, i) => {
            if (nd.x === undefined || isNaN(nd.x)) {
                const a = (2 * Math.PI * i / n) - Math.PI / 2;
                nd.x = w / 2 + (w * 0.35) * Math.cos(a);
                nd.y = h / 2 + (h * 0.35) * Math.sin(a);
            }
        });

        const nodeIdx = new Map(nodes.map((nd, i) => [nd.id, i]));
        const k = Math.sqrt((w * h) / n); // ideal inter-node distance

        for (let iter = 0; iter < 200; iter++) {
            const temp = k * (1 - iter / 200); // cooling factor
            const disp = nodes.map(() => ({ x: 0, y: 0 }));

            // Repulsion between every pair
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let dx = nodes[i].x - nodes[j].x || 0.01;
                    let dy = nodes[i].y - nodes[j].y || 0.01;
                    const dist  = Math.sqrt(dx * dx + dy * dy) || 0.01;
                    const force = (k * k) / dist;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    disp[i].x += fx; disp[i].y += fy;
                    disp[j].x -= fx; disp[j].y -= fy;
                }
            }

            // Attraction along edges (undirected, deduplicated)
            const seen = new Set();
            for (const e of this._edges) {
                const key = [e.from, e.to].sort().join(',');
                if (seen.has(key)) continue;
                seen.add(key);
                const si = nodeIdx.get(e.from);
                const ti = nodeIdx.get(e.to);
                if (si === undefined || ti === undefined || si === ti) continue;
                let dx = nodes[si].x - nodes[ti].x || 0.01;
                let dy = nodes[si].y - nodes[ti].y || 0.01;
                const dist  = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const force = (dist * dist) / k;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                disp[si].x -= fx; disp[si].y -= fy;
                disp[ti].x += fx; disp[ti].y += fy;
            }

            // Apply displacement with cooling, clamp to canvas
            nodes.forEach((nd, i) => {
                const d     = Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2) || 1;
                const scale = Math.min(d, temp) / d;
                nd.x += disp[i].x * scale;
                nd.y += disp[i].y * scale;
                nd.x = Math.max(pad, Math.min(w - pad, nd.x));
                nd.y = Math.max(pad, Math.min(h - pad, nd.y));
            });
        }
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

        const svg = document.createElementNS(NS, 'svg');
        // Use explicit pixel dimensions so the SVG has real size from the first paint
        svg.setAttribute('width',   w);
        svg.setAttribute('height',  h);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('class', 'viz-graph-svg');
        this._svgEl = svg;

        // Defs: arrowhead
        const defs = document.createElementNS(NS, 'defs');
        defs.appendChild(this._mkArrow(NS, 'graph-arrow', '#6e9ccf'));
        svg.appendChild(defs);

        // Edge group
        this._edgeGroupEl = document.createElementNS(NS, 'g');
        svg.appendChild(this._edgeGroupEl);
        this._redrawEdges(NS);

        // Node group
        const nodeGroup = document.createElementNS(NS, 'g');
        const NODE_R = 18;
        for (const nd of this._nodes) {
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'viz-graph-node');
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
        }
        svg.appendChild(nodeGroup);
        this._svgContainer.appendChild(svg);

        // Resize the parent block to fit this SVG on every render
        this._resizeBlock();
    }

    // Re-measure the parent .block element to fit whatever was just rendered
    _resizeBlock() {
        const block = this.container.closest ? this.container.closest('.block') : null;
        if (!block) return;
        block.style.display  = 'inline-flex';
        const w = Math.max(block.scrollWidth,  150);
        const h = Math.max(block.scrollHeight, 80);
        block.style.display  = 'flex';
        block.style.width    = `${w}px`;
        block.style.height   = `${h}px`;
    }

    // ── Edge drawing (called on full render and on drag) ──────────────────────

    _redrawEdges(NS) {
        if (!this._edgeGroupEl) return;
        const _NS = NS || 'http://www.w3.org/2000/svg';
        this._edgeGroupEl.innerHTML = '';

        const nodeMap = new Map(this._nodes.map(n => [n.id, n]));
        const edgeSet  = new Set(this._edges.map(e => `${e.from},${e.to}`));
        const drawn    = new Set();

        // next-format: use arc drawing keyed on index position, not general curves
        if (this.format === 'next') {
            for (const edge of this._edges) {
                this._drawChainEdge(_NS, nodeMap.get(edge.from), nodeMap.get(edge.to), edge);
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

            if (isSelf) {
                this._drawSelfLoop(_NS, src, edge);
            } else if (this.directed && isBidi) {
                // Two opposing curves with arrowheads
                this._drawCurvedEdge(_NS, src, tgt,  1, edge, true);
                const rev = this._edges.find(e => e.from === edge.to && e.to === edge.from);
                this._drawCurvedEdge(_NS, tgt, src, -1, rev || edge, true);
                drawn.add(reverseKey);
            } else if (this.directed) {
                // Single directed edge — gentle curve with arrowhead
                this._drawCurvedEdge(_NS, src, tgt, 0, edge, true);
            } else {
                // Undirected — same gentle curve shape, no arrowhead, deduplicated
                this._drawCurvedEdge(_NS, src, tgt, 0, edge, false);
                drawn.add(reverseKey);
            }
            drawn.add(key);
        }
    }

    // Chain arc edge: straight for gap=1, upward quadratic arc for gap>1.
    // Arc height = gap * ARC_STEP so longer jumps never cross shorter ones.
    _drawChainEdge(NS, src, tgt, edge) {
        if (!src || !tgt) return;
        const R        = 18;
        const ARC_STEP = 32; // must match _canvasSize
        const gap      = Math.abs(tgt.id - src.id);
        const withArrow = this.directed;

        if (gap <= 1) {
            // Straight horizontal line between node edges
            this._drawStraightEdge(NS, src, tgt, edge);
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
        path.setAttribute('fill', 'none');
        if (withArrow) path.setAttribute('marker-end', 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(path);

        if (this.weights === 'weighted' && edge.weight !== null) {
            const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
            const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
            this._drawLabel(NS, lx, ly, edge.weight);
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

    _drawStraightEdge(NS, src, tgt, edge) {
        const R   = 18;
        const dx  = tgt.x - src.x, dy = tgt.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx  = dx / len,       ny = dy / len;
        const x1 = src.x + nx * R, y1 = src.y + ny * R;
        const x2 = tgt.x - nx * R, y2 = tgt.y - ny * R;

        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'viz-graph-edge');
        this._edgeGroupEl.appendChild(line);

        if (this.weights === 'weighted' && edge.weight !== null) {
            this._drawLabel(NS, (x1 + x2) / 2, (y1 + y2) / 2, edge.weight);
        }
    }

    /**
     * curveDir: -1 = curve right, 0 = small left curve, 1 = curve left
     */
    _drawCurvedEdge(NS, src, tgt, curveDir, edge, withArrow) {
        const R          = 18;
        const curvature  = curveDir === 0 ? 20 : 40;
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
        path.setAttribute('fill', 'none');
        if (withArrow) path.setAttribute('marker-end', 'url(#graph-arrow)');
        this._edgeGroupEl.appendChild(path);

        if (this.weights === 'weighted' && edge.weight !== null) {
            // Label at quadratic bezier midpoint (t=0.5)
            const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
            const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
            this._drawLabel(NS, lx, ly, edge.weight);
        }
    }

    _drawSelfLoop(NS, node, edge) {
        const R   = 18;
        const lx  = node.x - R * 0.7;
        const rx  = node.x + R * 0.7;
        const top = node.y - R - 28;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d',
            `M ${lx} ${node.y - R * 0.5} C ${lx - 28} ${top} ${rx + 28} ${top} ${rx} ${node.y - R * 0.5}`);
        path.setAttribute('class', 'viz-graph-edge');
        path.setAttribute('fill', 'none');
        if (this.directed) path.setAttribute('marker-end', 'url(#graph-arrow)');
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
