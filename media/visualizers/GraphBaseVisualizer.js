// @ts-nocheck
console.log('[YTP] GraphBaseVisualizer.js loaded');

/**
 * Shared base class for graph-like visualizers (GraphVisualizer, LinkedListVisualizer).
 * Contains common layout algorithms, SVG helpers, and block sizing logic.
 *
 * Subclasses must set:
 *   this._nodes = [{id, x, y, ...}]
 *   this._edges = [{from, to, ...}]
 *
 * Subclasses must override:
 *   _buildToolbar()   – construct toolbar DOM
 *   update(variable)  – entry point for new data
 *   _canvasSize()     – returns {w, h} for layout coordinate space
 *   _refresh()        – parse data → layout → render
 */
class GraphBaseVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);

        this._nodes = [];
        this._edges = [];
        this.layout    = 'circle';
        this.layerRoot = null;
        this.directed  = true;

        this._desiredW = 300;
        this._desiredH = 200;

        // SVG container (shared by both Graph and LinkedList)
        this._svgContainer = document.createElement('div');
        this._svgContainer.className = 'viz-graph-container';
        this.container.appendChild(this._svgContainer);
    }

    // ── Desired size / resize (identical in both subclasses) ────────────────

    getDesiredSize() {
        return { w: this._desiredW || 300, h: this._desiredH || 200 };
    }

    onContainerResize(_w, _h) {}

    /** Store desired content dimensions so Manager can size the block. */
    _resizeBlock(naturalW, naturalH) {
        this._desiredW = Math.max(naturalW, 150);
        this._desiredH = Math.max(naturalH, 80);
        const block = this.container.closest ? this.container.closest('.block') : null;
        if (block) {
            block.style.display = 'flex';
            block.dataset.vizSized = '1';
        }
    }

    /**
     * Update SVG viewBox to tightly fit content.
     * Uses getBBox() as requested for robust bounds detection.
     */
    fitSvg(padding = 10) {
        const svg = this._svgEl || this.container.querySelector('svg');
        if (!svg) return;
        
        // Force a browser layout calc if needed?
        // Usually getBBox works on rendered content.
        requestAnimationFrame(() => {
            try {
                const bbox = svg.getBBox();
                if (bbox.width <= 0 || bbox.height <= 0) return;
                
                const vb = [
                    bbox.x - padding,
                    bbox.y - padding,
                    bbox.width + padding * 2,
                    bbox.height + padding * 2
                ].join(' ');
                
                svg.setAttribute('viewBox', vb);
            } catch (e) {
                console.warn('fitSvg error:', e);
            }
        });
    }

    // ── Layout: Circle ──────────────────────────────────────────────────────

    _layoutCircle(w, h) {
        const r = Math.min(w, h) * 0.36;
        const cx = w / 2, cy = h / 2;
        this._nodes.forEach((nd, i) => {
            const a = (2 * Math.PI * i / this._nodes.length) - Math.PI / 2;
            nd.x = cx + r * Math.cos(a);
            nd.y = cy + r * Math.sin(a);
        });
    }

    // ── Layout: Spring (Fruchterman-Reingold) ───────────────────────────────

    /**
     * @param {number} w        canvas width
     * @param {number} h        canvas height
     * @param {number} iterations  simulation iterations (default 200)
     * @param {number} pad       boundary padding in px (default 28)
     * @param {function} [nodeIdFn]  optional: node → key for edge lookup (default: nd.id)
     */
    _layoutSpring(w, h, iterations = 200, pad = 28, nodeIdFn) {
        const nodes = this._nodes;
        const n = nodes.length;
        if (n === 0) return;

        // Seed positions on a circle if not yet placed
        nodes.forEach((nd, i) => {
            if (nd.x === undefined || isNaN(nd.x)) {
                const a = (2 * Math.PI * i / n) - Math.PI / 2;
                nd.x = w / 2 + (w * 0.35) * Math.cos(a);
                nd.y = h / 2 + (h * 0.35) * Math.sin(a);
            }
        });

        const getId = nodeIdFn || (nd => nd.id);
        const nodeIdx = new Map(nodes.map((nd, i) => [getId(nd), i]));
        const k = Math.sqrt((w * h) / n);

        for (let iter = 0; iter < iterations; iter++) {
            const temp = k * (1 - iter / iterations);
            const disp = nodes.map(() => ({ x: 0, y: 0 }));

            // Repulsion between every pair
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let dx = nodes[i].x - nodes[j].x || 0.01;
                    let dy = nodes[i].y - nodes[j].y || 0.01;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                    const force = (k * k) / dist;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    disp[i].x += fx; disp[i].y += fy;
                    disp[j].x -= fx; disp[j].y -= fy;
                }
            }

            // Attraction along edges (deduplicated)
            const seen = new Set();
            for (const e of this._edges) {
                const si = nodeIdx.get(e.from);
                const ti = nodeIdx.get(e.to);
                if (si === undefined || ti === undefined || si === ti) continue;
                const key = [si, ti].sort().join(',');
                if (seen.has(key)) continue;
                seen.add(key);
                let dx = nodes[si].x - nodes[ti].x || 0.01;
                let dy = nodes[si].y - nodes[ti].y || 0.01;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const force = (dist * dist) / k;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                disp[si].x -= fx; disp[si].y -= fy;
                disp[ti].x += fx; disp[ti].y += fy;
            }

            // Apply displacement with cooling, clamp to canvas
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

    // ── BFS layer computation ───────────────────────────────────────────────

    /**
     * Compute BFS layers from edges.
     * @param {Array} nodeKeys   ordered array of node keys (e.g. [0,1,2] or ['head','next',...])
     * @param {Array} edges      [{from, to}] where from/to are keys from nodeKeys
     * @param {*}     rootKey    user-specified root key, or null for auto-detect
     * @returns {Map<number, Array>}  layerIndex -> [nodeKey, ...]
     */
    _computeLayersBFS(nodeKeys, edges, rootKey) {
        const keySet = new Set(nodeKeys);
        const adj   = new Map(nodeKeys.map(k => [k, []]));
        const inDeg = new Map(nodeKeys.map(k => [k, 0]));
        const seen  = new Set();

        for (const e of edges) {
            if (!keySet.has(e.from) || !keySet.has(e.to)) continue;
            const key = `${e.from},${e.to}`;
            if (seen.has(key) || e.from === e.to) continue;
            seen.add(key);
            if (adj.has(e.from)) adj.get(e.from).push(e.to);
            if (inDeg.has(e.to)) inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
        }

        const layer = new Map();
        let roots;
        if (rootKey !== null && rootKey !== undefined && keySet.has(rootKey)) {
            roots = [rootKey];
        } else {
            roots = nodeKeys.filter(k => (inDeg.get(k) || 0) === 0);
        }
        if (roots.length === 0 && nodeKeys.length > 0) roots = [nodeKeys[0]];

        const queue = roots.slice();
        roots.forEach(k => layer.set(k, 0));
        let qi = 0;
        while (qi < queue.length) {
            const k = queue[qi++];
            for (const nk of (adj.get(k) || [])) {
                if (!layer.has(nk)) {
                    layer.set(nk, layer.get(k) + 1);
                    queue.push(nk);
                }
            }
        }

        // Disconnected nodes go to last layer + 1
        const maxL = layer.size > 0 ? Math.max(...layer.values()) : 0;
        nodeKeys.forEach(k => { if (!layer.has(k)) layer.set(k, maxL + 1); });

        const byLayer = new Map();
        layer.forEach((l, k) => {
            if (!byLayer.has(l)) byLayer.set(l, []);
            byLayer.get(l).push(k);
        });
        return byLayer;
    }

    // ── Tight viewBox computation ───────────────────────────────────────────

    /**
     * Compute a tight viewBox from actual node positions after layout.
     * @param {Array} nodeExtents  [{x, y, halfW, halfH}] per node
     *   For circle nodes: halfW = halfH = radius
     *   For rect nodes: halfW = width/2, halfH = height/2
     * @param {number} [marginFrac=0.12]  proportional margin (fraction of span)
     * @returns {{vbX, vbY, vbW, vbH}}  viewBox parameters
     */
    _computeTightViewBox(nodeExtents, marginFrac = 0.12) {
        if (!nodeExtents || nodeExtents.length === 0) {
            return { vbX: 0, vbY: 0, vbW: 300, vbH: 200 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodeExtents) {
            minX = Math.min(minX, n.x - n.halfW);
            minY = Math.min(minY, n.y - n.halfH);
            maxX = Math.max(maxX, n.x + n.halfW);
            maxY = Math.max(maxY, n.y + n.halfH);
        }

        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        const mx = spanX * marginFrac;
        const my = spanY * marginFrac;

        return {
            vbX: minX - mx,
            vbY: minY - my,
            vbW: spanX + 2 * mx,
            vbH: spanY + 2 * my
        };
    }

    /**
     * Expand viewBox in one dimension to match a target aspect ratio.
     * This prevents SVG letterboxing without distortion or relayout.
     * @param {{vbX, vbY, vbW, vbH}} vb  current viewBox
     * @param {number} containerW  block content width
     * @param {number} containerH  block content height
     * @returns {{vbX, vbY, vbW, vbH}}
     */
    _matchViewBoxAspect(vb, containerW, containerH) {
        if (!containerW || !containerH || containerW <= 0 || containerH <= 0) return vb;
        const vbAspect = vb.vbW / vb.vbH;
        const cAspect  = containerW / containerH;

        if (Math.abs(vbAspect - cAspect) < 0.01) return vb; // already matched

        const result = { ...vb };
        if (cAspect > vbAspect) {
            // Container is wider → expand viewBox width
            const newW = vb.vbH * cAspect;
            result.vbX -= (newW - vb.vbW) / 2;
            result.vbW = newW;
        } else {
            // Container is taller → expand viewBox height
            const newH = vb.vbW / cAspect;
            result.vbY -= (newH - vb.vbH) / 2;
            result.vbH = newH;
        }
        return result;
    }

    // ── SVG arrow marker ────────────────────────────────────────────────────

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
}
