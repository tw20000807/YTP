// @ts-nocheck
console.log('[YTP] MatrixVisualizer.js loaded');

class MatrixVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.rowBase = 0;
        this.colBase = 0;
        this.rowLimit = null; 
        this.colLimit = null;
        this.variable = null;
        this._prevValues = new Map(); 

        this.matrixContainer = document.createElement('div');
        this.matrixContainer.className = 'viz-matrix-grid';
        this.container.appendChild(this.matrixContainer);

        this._toolbar = this._buildToolbar();
    }

    getToolbar() {
        return this._toolbar;
    }

    _buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'viz-matrix-toolbar';

        this._createControl(toolbar, 'Row Base', '0', (val) => {
            this.rowBase = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            this._render();
        });
        this._createControl(toolbar, 'Row Limit', 'all', (val) => {
            this.rowLimit = val === '' || val === 'all' ? null : Math.max(1, parseInt(val) || 1);
            this._render();
        });

        this._createControl(toolbar, 'Col Base', '0', (val) => {
            this.colBase = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            this._render();
        });
        this._createControl(toolbar, 'Col Limit', 'all', (val) => {
            this.colLimit = val === '' || val === 'all' ? null : Math.max(1, parseInt(val) || 1);
            this._render();
        });

        return toolbar;
    }

    _createControl(toolbar, labelText, placeholder, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-matrix-control';

        const label = document.createElement('label');
        label.textContent = labelText + ': ';

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.className = 'viz-matrix-input';
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('change', (e) => onChange(e.target.value));

        label.appendChild(input);
        group.appendChild(label);
        toolbar.appendChild(group);
    }

    update(variable) {
        this._prevValues = new Map();
        if (this.variable && this.variable.children) {
            this.variable.children.forEach((row, r) => {
                if (row.children) {
                    row.children.forEach((cell, c) => {
                        this._prevValues.set(`${r},${c}`, cell.value);
                    });
                }
            });
        }
        this.variable = variable;
        this._render();
    }

    _render() {
        this.matrixContainer.innerHTML = '';

        if (!this.variable || !this.variable.children || this.variable.children.length === 0) {
            this.matrixContainer.textContent = 'No Matrix Data';
            return;
        }

        const rows = this.variable.children;
        const rStart = this.rowBase;
        const rEnd = this.rowLimit === null ? rows.length : Math.min(rows.length, rStart + this.rowLimit);

        for (let r = rStart; r < rEnd; r++) {
            const rowData = rows[r];
            if (!rowData.children) continue;

            const rowElement = document.createElement('div');
            rowElement.className = 'viz-matrix-row';

            const cols = rowData.children;
            const cStart = this.colBase;
            const cEnd = this.colLimit === null ? cols.length : Math.min(cols.length, cStart + this.colLimit);

            for (let c = cStart; c < cEnd; c++) {
                const cellData = cols[c];
                const cell = document.createElement('div');
                
                const key = `${r},${c}`;
                const changed = this._prevValues.has(key) && this._prevValues.get(key) !== cellData.value;
                
                cell.className = 'viz-matrix-cell' + (changed ? ' viz-matrix-cell--changed' : '');
                
                cell.innerHTML = `
                    <div class="viz-matrix-coord">(${r},${c})</div>
                    <div class="viz-matrix-val">${cellData.value}</div>
                `;
                if (cellData.type) cell.title = `Type: ${cellData.type}`;

                rowElement.appendChild(cell);
            }
            this.matrixContainer.appendChild(rowElement);
        }
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Matrix', MatrixVisualizer);
}