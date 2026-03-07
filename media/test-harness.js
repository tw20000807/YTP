// @ts-nocheck
/**
 * YTP Test Harness Script
 * This file provides test data loading and control for the standalone test.html page.
 * It is NOT loaded by the VS Code webview (main.js handles that).
 */

// Test data definitions
const TEST_DATA = {
    'array-matrix': {
        frameId: 1,
        scopes: [{
            name: 'Locals',
            variables: [
                {
                    single: 'numbers', name: 'numbers', value: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]', type: 'std::vector<int>',
                    children: [
                        { single: '[0]', name: 'numbers[0]', value: '1', type: 'int' },
                        { single: '[1]', name: 'numbers[1]', value: '2', type: 'int' },
                        { single: '[2]', name: 'numbers[2]', value: '3', type: 'int' },
                        { single: '[3]', name: 'numbers[3]', value: '4', type: 'int' },
                        { single: '[4]', name: 'numbers[4]', value: '5', type: 'int' },
                        { single: '[5]', name: 'numbers[5]', value: '6', type: 'int' },
                        { single: '[6]', name: 'numbers[6]', value: '7', type: 'int' },
                        { single: '[7]', name: 'numbers[7]', value: '8', type: 'int' },
                        { single: '[8]', name: 'numbers[8]', value: '9', type: 'int' },
                        { single: '[9]', name: 'numbers[9]', value: '10', type: 'int' }
                    ]
                },
                {
                    single: 'matrix', name: 'matrix', value: '[[1,2,3],[4,5,6],[7,8,9]]', type: 'std::vector<std::vector<int>>',
                    children: [
                        { single: '[0]', name: 'matrix[0]', value: '[1, 2, 3]', type: 'std::vector<int>', children: [
                            { single: '[0]', name: 'matrix[0][0]', value: '1', type: 'int' },
                            { single: '[1]', name: 'matrix[0][1]', value: '2', type: 'int' },
                            { single: '[2]', name: 'matrix[0][2]', value: '3', type: 'int' }
                        ]},
                        { single: '[1]', name: 'matrix[1]', value: '[4, 5, 6]', type: 'std::vector<int>', children: [
                            { single: '[0]', name: 'matrix[1][0]', value: '4', type: 'int' },
                            { single: '[1]', name: 'matrix[1][1]', value: '5', type: 'int' },
                            { single: '[2]', name: 'matrix[1][2]', value: '6', type: 'int' }
                        ]},
                        { single: '[2]', name: 'matrix[2]', value: '[7, 8, 9]', type: 'std::vector<int>', children: [
                            { single: '[0]', name: 'matrix[2][0]', value: '7', type: 'int' },
                            { single: '[1]', name: 'matrix[2][1]', value: '8', type: 'int' },
                            { single: '[2]', name: 'matrix[2][2]', value: '9', type: 'int' }
                        ]}
                    ]
                }
            ]
        }]
    },
    'linked-list': {
        frameId: 1,
        scopes: [{
            name: 'Locals',
            variables: [{
                single: 'head', name: 'head', value: '0x7ffeefbff5a0', type: 'ListNode*',
                children: [
                    { single: 'val', name: 'head->val', value: '1', type: 'int' },
                    { single: 'next', name: 'head->next', value: '0x7ffeefbff5b0', type: 'ListNode*', children: [
                        { single: 'val', name: 'head->next->val', value: '2', type: 'int' },
                        { single: 'next', name: 'head->next->next', value: '0x7ffeefbff5c0', type: 'ListNode*', children: [
                            { single: 'val', name: 'head->next->next->val', value: '3', type: 'int' },
                            { single: 'next', name: 'head->next->next->next', value: '0x7ffeefbff5d0', type: 'ListNode*', children: [
                                { single: 'val', name: 'head->next->next->next->val', value: '4', type: 'int' },
                                { single: 'next', name: 'head->next->next->next->next', value: '0x0', type: 'ListNode*' }
                            ]}
                        ]}
                    ]}
                ]
            }]
        }]
    },
    'graph': {
        frameId: 1,
        scopes: [{
            name: 'Locals',
            variables: [{
                single: 'adj', name: 'adj', value: 'adjacency list', type: 'std::vector<std::vector<int>>',
                children: [
                    { single: '[0]', name: 'adj[0]', value: '[1, 2]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[0][0]', value: '1', type: 'int' },
                        { single: '[1]', name: 'adj[0][1]', value: '2', type: 'int' }
                    ]},
                    { single: '[1]', name: 'adj[1]', value: '[0, 3, 4]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[1][0]', value: '0', type: 'int' },
                        { single: '[1]', name: 'adj[1][1]', value: '3', type: 'int' },
                        { single: '[2]', name: 'adj[1][2]', value: '4', type: 'int' }
                    ]},
                    { single: '[2]', name: 'adj[2]', value: '[0, 5]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[2][0]', value: '0', type: 'int' },
                        { single: '[1]', name: 'adj[2][1]', value: '5', type: 'int' }
                    ]},
                    { single: '[3]', name: 'adj[3]', value: '[1]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[3][0]', value: '1', type: 'int' }
                    ]},
                    { single: '[4]', name: 'adj[4]', value: '[1]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[4][0]', value: '1', type: 'int' }
                    ]},
                    { single: '[5]', name: 'adj[5]', value: '[2]', type: 'std::vector<int>', children: [
                        { single: '[0]', name: 'adj[5][0]', value: '2', type: 'int' }
                    ]}
                ]
            }]
        }]
    },
    'json-text': {
        frameId: 1,
        scopes: [{
            name: 'Locals',
            variables: [
                { single: 'jsonData', name: 'jsonData', value: '{"name":"John","age":30,"city":"New York","hobbies":["reading","gaming"],"address":{"street":"123 Main St","zip":"10001"}}', type: 'std::string' },
                { single: 'message', name: 'message', value: '"Hello, World! This is a test message for the text visualizer."', type: 'std::string' }
            ]
        }]
    }
};

// Test harness controller
class TestHarness {
    constructor() {
        this.statusEl = document.getElementById('status');
        this.presetSelect = document.getElementById('preset-select');
        this.jsonInput = document.getElementById('json-input');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.controls = document.getElementById('test-controls');

        this.setupEventListeners();
        this.setStatus('Ready', 'info');
    }

    setupEventListeners() {
        // Preset select
        this.presetSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (key && TEST_DATA[key]) {
                this.loadData(TEST_DATA[key]);
            }
        });

        // Load JSON button
        document.getElementById('load-json-btn').addEventListener('click', () => {
            try {
                const data = JSON.parse(this.jsonInput.value);
                if (data.scopes) {
                    this.loadData(data);
                } else {
                    this.setStatus('Error: Missing "scopes" field', 'error');
                }
            } catch (e) {
                this.setStatus('Error: ' + e.message, 'error');
            }
        });

        // Clear button
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (window.controller && window.controller.visualizerManager) {
                const blocks = Array.from(window.controller.visualizerManager.blocks.keys());
                blocks.forEach(path => {
                    window.controller.visualizerManager.removeBlock(path);
                    const cb = document.querySelector(`.var-checkbox[data-path="${path}"]`);
                    if (cb) cb.checked = false;
                });
                this.setStatus('All blocks cleared', 'success');
            }
        });

        // Reload button
        document.getElementById('reload-btn').addEventListener('click', () => {
            location.reload();
        });

        // Minimize toggle
        this.minimizeBtn.addEventListener('click', () => {
            this.controls.classList.toggle('minimized');
            this.minimizeBtn.textContent = this.controls.classList.contains('minimized') ? '+' : '−';
        });
    }

    loadData(testData) {
        if (!window.controller) {
            this.setStatus('Error: Controller not initialized', 'error');
            return;
        }

        try {
            const message = {
                command: 'updateVariables',
                scopes: testData.scopes.map(scope => ({
                    name: scope.name,
                    variables: scope.variables
                }))
            };
            window.controller.populateVarMap(message.scopes);
            window.controller.renderVariableList(message.scopes);
            window.controller.visualizerManager.updateAll(window.controller.varMap);

            const varCount = window.controller.varMap.size;
            this.setStatus(`Loaded ${varCount} variables`, 'success');
            console.log('[TestHarness] Data loaded:', testData);
        } catch (e) {
            this.setStatus('Error: ' + e.message, 'error');
            console.error('[TestHarness] Error loading data:', e);
        }
    }

    setStatus(message, type = 'info') {
        this.statusEl.textContent = message;
        this.statusEl.className = 'status';
        if (type === 'success') this.statusEl.classList.add('success');
        if (type === 'error') this.statusEl.classList.add('error');
    }
}

// Initialize test harness when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.testHarness = new TestHarness();
    });
} else {
    window.testHarness = new TestHarness();
}
