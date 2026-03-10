// @ts-nocheck
console.log('[YTP] MatrixVisualizer.js loaded');

class MatrixVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.rowBase = 0;
        this.colBase = 0;
        this.rowLimit = null; // null = show all (inclusive end row)
        this.colLimit = null; // null = show all (inclusive end col)
        this.variable = null;
        this._prevValues = new Map();
        this._dynCellW = null;  // set by onContainerResize
        this._dynCellH = null; 

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
            this.rowLimit = val === '' || val === 'all' ? null : Math.max(0, parseInt(val) || 0);
            this._render();
        });

        this._createControl(toolbar, 'Col Base', '0', (val) => {
            this.colBase = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            this._render();
        });
        this._createControl(toolbar, 'Col Limit', 'all', (val) => {
            this.colLimit = val === '' || val === 'all' ? null : Math.max(0, parseInt(val) || 0);
            this._render();
        });

        return toolbar;
    }

    _createControl(toolbar, labelText, placeholder, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-control';

        const span = document.createElement('span');
        span.className = 'viz-ctrl-label';
        span.textContent = labelText + ': ';

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.className = 'viz-input';
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('change', (e) => onChange(e.target.value));

        group.appendChild(span);
        group.appendChild(input);
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

    /** Called by Manager when the block is resized. Adjusts cell size to fill the available space. */
    onContainerResize(w, h) {
        if (!this.variable || !this.variable.children) return;

        const rows = this.variable.children;
        if (rows.length === 0) return;

        const rStart = Math.min(Math.max(0, this.rowBase), rows.length - 1);
        const rEnd = this.rowLimit === null
            ? rows.length - 1
            : Math.min(Math.max(0, this.rowLimit), rows.length - 1);
        if (rEnd < rStart) return;
        const numRows = rEnd - rStart + 1;

        // Use max visible column count (not only first row), otherwise wider rows overflow.
        const cStart = Math.max(0, this.colBase);
        let numCols = 0;
        for (let r = rStart; r <= rEnd; r++) {
            const row = rows[r];
            const cols = (row && row.children) ? row.children : [];
            if (cols.length === 0) continue;
            const cEnd = this.colLimit === null
                ? cols.length - 1
                : Math.min(Math.max(0, this.colLimit), cols.length - 1);
            if (cEnd < cStart) continue;
            numCols = Math.max(numCols, cEnd - cStart + 1);
        }
        if (numCols <= 0) return;

        if (w && w > 0) this._dynCellW = Math.floor(w / numCols);
        if (h && h > 0) this._dynCellH = Math.floor(h / numRows);

        const fontScale = Math.max(0.5, Math.min(1.2, Math.min(this._dynCellW, this._dynCellH) / 42));
        this.matrixContainer.style.fontSize = `${fontScale}em`;
        this._render();
    }

    _render() {
        this.matrixContainer.innerHTML = '';
        this._elements = [];

        if (!this.variable || !this.variable.children || this.variable.children.length === 0) {
            this.matrixContainer.textContent = 'No Matrix Data';
            return;
        }

        const rows = this.variable.children;
        const rStart = Math.min(Math.max(0, this.rowBase), Math.max(0, rows.length - 1));
        const rEnd = this.rowLimit === null
            ? rows.length - 1
            : Math.min(Math.max(0, this.rowLimit), Math.max(0, rows.length - 1));
        if (rEnd < rStart) return;

        // Use total column count for linear index calculation
        const maxCols = rows.reduce((mx, row) => Math.max(mx, row.children ? row.children.length : 0), 0);

        for (let r = rStart; r <= rEnd; r++) {
            const rowData = rows[r];
            if (!rowData.children) continue;

            const rowElement = document.createElement('div');
            rowElement.className = 'viz-matrix-row';

            const cols = rowData.children;
            const cStart = Math.max(0, this.colBase);
            const cEnd = this.colLimit === null
                ? cols.length - 1
                : Math.min(Math.max(0, this.colLimit), cols.length - 1);
            if (cEnd < cStart) continue;

            for (let c = cStart; c <= cEnd; c++) {
                const cellData = cols[c];
                const cell = document.createElement('div');
                
                const key = `${r},${c}`;
                const changed = this._prevValues.has(key) && this._prevValues.get(key) !== cellData.value;
                
                cell.className = 'viz-matrix-cell' + (changed ? ' viz-matrix-cell--changed' : '');

                // Apply dynamic dimensions determined by onContainerResize
                if (this._dynCellW) {
                    const w = `${this._dynCellW}px`;
                    cell.style.width = w;
                    cell.style.flex = `0 0 ${w}`;
                }
                if (this._dynCellH) {
                    const h = `${this._dynCellH}px`;
                    cell.style.height = h;
                }
                
                cell.innerHTML = `
                    <div class="viz-matrix-coord">(${r},${c})</div>
                    <div class="viz-matrix-val">${cellData.value}</div>
                `;
                if (cellData.type) cell.title = `Type: ${cellData.type}`;

                rowElement.appendChild(cell);

                // Flattened linear index for modifier targeting
                this._elements.push({ index: r * maxCols + c, domRef: cell, text: cellData.value });
            }
            this.matrixContainer.appendChild(rowElement);
        }
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Matrix', MatrixVisualizer);
}