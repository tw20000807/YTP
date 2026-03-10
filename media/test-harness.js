// @ts-nocheck
// Test Harness for YTP Visualizers
// Loads test data and feeds it to the VisualizerController via synthetic messages.

(function () {
    'use strict';

    // --- Preset test data ---------------------------------------------------

    const PRESETS = {
        'array-matrix': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    {
                        name: 'arr',
                        value: '[10]',
                        type: 'int [10]',
                        children: Array.from({ length: 10 }, (_, i) => ({
                            name: `(arr)[${i}]`,
                            value: String(i + 1),
                            type: 'int'
                        }))
                    },
                    {
                        name: 'matrix',
                        value: '[3][4]',
                        type: 'int [3][4]',
                        children: Array.from({ length: 3 }, (_, r) => ({
                            name: `(matrix)[${r}]`,
                            value: `[4]`,
                            type: 'int [4]',
                            children: Array.from({ length: 4 }, (__, c) => ({
                                name: `(matrix)[${r}][${c}]`,
                                value: String(r * 4 + c + 1),
                                type: 'int'
                            }))
                        }))
                    },
                    { name: 'n', value: '10', type: 'int' },
                    { name: 'l', value: '2', type: 'int' },
                    { name: 'r', value: '7', type: 'int' }
                ]
            }]
        },

        'linked-list': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    buildLinkedList('head', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
                ]
            }]
        },

        'graph': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    buildAdjMatrix('adj', 5, [[0,1],[0,2],[1,3],[1,4]]),
                    { name: 'N', value: '5', type: 'int' }
                ]
            }]
        },

        'weighted-adj-list': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    buildWeightedAdjList('wAdj', 5, [[0,1,3],[0,2,7],[1,3,2],[1,4,5],[2,4,1]]),
                    { name: 'N', value: '5', type: 'int' }
                ]
            }]
        },

        'edge-list': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    buildEdgeList('edges', [[0,1],[0,2],[1,3],[2,3],[3,4]]),
                    buildWeightedEdgeList('wEdges', [[0,1,5],[0,2,3],[1,3,2],[2,3,7],[3,4,1]])
                ]
            }]
        },

        'heap': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    buildHeapArray('heap', [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]),
                    { name: 'heapSize', value: '10', type: 'int' }
                ]
            }]
        },

        'json-text': {
            frameId: 1001,
            scopes: [{
                name: 'Locals',
                variables: [
                    { name: 'msg', value: '"Hello, World!"', type: 'const char *' },
                    {
                        name: 'config',
                        value: '{...}',
                        type: 'struct Config',
                        children: [
                            { name: 'width', value: '800', type: 'int' },
                            { name: 'height', value: '600', type: 'int' },
                            { name: 'title', value: '"My Window"', type: 'const char *' },
                            {
                                name: 'flags',
                                value: '{...}',
                                type: 'struct Flags',
                                children: [
                                    { name: 'fullscreen', value: '0', type: 'bool' },
                                    { name: 'resizable', value: '1', type: 'bool' }
                                ]
                            }
                        ]
                    }
                ]
            }]
        }
    };

    // --- Helper builders ----------------------------------------------------

    function buildLinkedList(name, values) {
        let current = null;
        for (let i = values.length - 1; i >= 0; i--) {
            const addr = '0x' + (0xfac000 + i * 0x40).toString(16);
            const node = {
                name: i === 0
                    ? name
                    : `((Node *)${addr})`,
                value: addr,
                type: 'Node *',
                memoryReference: addr,
                children: [
                    {
                        name: `((Node *)${addr})->data`,
                        value: String(values[i]),
                        type: 'int'
                    },
                    {
                        name: `((Node *)${addr})->next`,
                        value: current ? current.value : '0x0',
                        type: 'Node *',
                        memoryReference: current ? current.value : '0x0',
                        children: current ? [current] : []
                    }
                ]
            };
            current = node;
        }
        return current;
    }

    function buildAdjMatrix(name, n, edges) {
        // Build NxN matrix filled with 0, set 1 for edges (both directions for undirected)
        const mat = Array.from({ length: n }, () => Array(n).fill(0));
        edges.forEach(([u, v]) => { mat[u][v] = 1; mat[v][u] = 1; });

        return {
            name: name,
            value: `[${n}][${n}]`,
            type: `int [${n}][${n}]`,
            children: Array.from({ length: n }, (_, r) => ({
                name: `(${name})[${r}]`,
                value: `[${n}]`,
                type: `int [${n}]`,
                children: Array.from({ length: n }, (__, c) => ({
                    name: `(${name})[${r}][${c}]`,
                    value: String(mat[r][c]),
                    type: 'int'
                }))
            }))
        };
    }

    function buildWeightedAdjList(name, n, edges) {
        // edges: [[u, v, w], ...] — build adj list of {to, weight} structs
        const adj = Array.from({ length: n }, () => []);
        edges.forEach(([u, v, w]) => { adj[u].push({ to: v, weight: w }); });

        return {
            name: name,
            value: `[${n}]`,
            type: `vector<vector<pair<int,int>>> [${n}]`,
            children: Array.from({ length: n }, (_, i) => ({
                name: `(${name})[${i}]`,
                value: `[${adj[i].length}]`,
                type: 'vector<pair<int,int>>',
                children: adj[i].map((e, j) => ({
                    name: `(${name})[${i}][${j}]`,
                    value: `{${e.to}, ${e.weight}}`,
                    type: 'pair<int,int>',
                    children: [
                        { name: `(${name})[${i}][${j}].first`, value: String(e.to), type: 'int' },
                        { name: `(${name})[${i}][${j}].second`, value: String(e.weight), type: 'int' }
                    ]
                }))
            }))
        };
    }

    function buildEdgeList(name, edges) {
        return {
            name: name,
            value: `[${edges.length}]`,
            type: `vector<pair<int,int>>`,
            children: edges.map(([u, v], i) => ({
                name: `(${name})[${i}]`,
                value: `{${u}, ${v}}`,
                type: 'pair<int,int>',
                children: [
                    { name: `(${name})[${i}].first`, value: String(u), type: 'int' },
                    { name: `(${name})[${i}].second`, value: String(v), type: 'int' }
                ]
            }))
        };
    }

    function buildWeightedEdgeList(name, edges) {
        return {
            name: name,
            value: `[${edges.length}]`,
            type: `vector<tuple<int,int,int>>`,
            children: edges.map(([u, v, w], i) => ({
                name: `(${name})[${i}]`,
                value: `{${u}, ${v}, ${w}}`,
                type: 'tuple<int,int,int>',
                children: [
                    { name: `(${name})[${i}][0]`, value: String(u), type: 'int' },
                    { name: `(${name})[${i}][1]`, value: String(v), type: 'int' },
                    { name: `(${name})[${i}][2]`, value: String(w), type: 'int' }
                ]
            }))
        };
    }

    function buildHeapArray(name, values) {
        return {
            name: name,
            value: `[${values.length}]`,
            type: `int [${values.length}]`,
            children: values.map((v, i) => ({
                name: `(${name})[${i}]`,
                value: String(v),
                type: 'int'
            }))
        };
    }

    // --- Normalize raw test file data ---------------------------------------

    function normalizeScopes(data) {
        if (!data || !data.scopes) return data;
        data.scopes = data.scopes
            .filter(s => s !== null && s !== undefined)
            .map(s => ({
                name: s.name || s.scopeName || 'Locals',
                variables: s.variables || []
            }));
        return data;
    }

    // --- UI wiring ----------------------------------------------------------

    const presetSelect = document.getElementById('preset-select');
    const jsonInput    = document.getElementById('json-input');
    const loadJsonBtn  = document.getElementById('load-json-btn');
    const clearBtn     = document.getElementById('clear-btn');
    const reloadBtn    = document.getElementById('reload-btn');
    const minimizeBtn  = document.getElementById('minimize-btn');
    const statusEl     = document.getElementById('status');
    const controlPanel = document.getElementById('test-controls');

    function setStatus(text, type) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = 'status' + (type ? ' ' + type : '');
    }

    function sendTestData(data) {
        const normalized = normalizeScopes(data);
        if (!normalized || !normalized.scopes || normalized.scopes.length === 0) {
            setStatus('Error: No valid scopes in data', 'error');
            return;
        }
        // Dispatch a synthetic message event matching what the extension sends.
        const message = {
            command: 'updateVariables',
            scopes: normalized.scopes,
            savedLayout: []
        };
        window.dispatchEvent(new MessageEvent('message', { data: message }));
        const varCount = normalized.scopes.reduce((sum, s) => sum + s.variables.length, 0);
        setStatus(`Loaded ${varCount} top-level variable(s)`, 'success');
    }

    // Preset selector
    if (presetSelect) {
        presetSelect.addEventListener('change', () => {
            const key = presetSelect.value;
            if (key && PRESETS[key]) {
                sendTestData(JSON.parse(JSON.stringify(PRESETS[key])));
            }
        });
    }

    // Custom JSON loader
    if (loadJsonBtn) {
        loadJsonBtn.addEventListener('click', () => {
            const raw = jsonInput ? jsonInput.value.trim() : '';
            if (!raw) { setStatus('Paste JSON first', 'error'); return; }
            try {
                const data = JSON.parse(raw);
                sendTestData(data);
            } catch (e) {
                setStatus('Invalid JSON: ' + e.message, 'error');
            }
        });
    }

    // Clear
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (window.controller && window.controller.visualizerManager) {
                const mgr = window.controller.visualizerManager;
                // Remove all visible blocks
                const paths = Array.from(mgr.blocks.keys());
                paths.forEach(p => mgr.removeBlock(p));
                // Uncheck all checkboxes
                document.querySelectorAll('.var-checkbox').forEach(cb => {
                    cb.checked = false;
                });
            }
            setStatus('Cleared', 'success');
        });
    }

    // Reload
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => location.reload());
    }

    // Minimize toggle
    if (minimizeBtn && controlPanel) {
        minimizeBtn.addEventListener('click', () => {
            controlPanel.classList.toggle('minimized');
            minimizeBtn.textContent = controlPanel.classList.contains('minimized') ? '+' : '−';
        });
    }

    // File loader for .YTP debug log .txt files
    const ytpFileInput = document.getElementById('ytp-file-input');
    const loadFileBtn  = document.getElementById('load-file-btn');
    if (loadFileBtn && ytpFileInput) {
        loadFileBtn.addEventListener('click', () => {
            const files = ytpFileInput.files;
            if (!files || files.length === 0) {
                setStatus('Select a .txt file first', 'error');
                return;
            }
            // Read the first selected file
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    sendTestData(data);
                    setStatus(`Loaded ${file.name}`, 'success');
                } catch (e) {
                    setStatus(`Error parsing ${file.name}: ${e.message}`, 'error');
                }
            };
            reader.onerror = () => setStatus(`Error reading ${file.name}`, 'error');
            reader.readAsText(file);
        });
    }

    setStatus('Ready — pick a preset or paste JSON', '');
})();
