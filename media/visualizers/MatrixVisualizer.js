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
        this.allVariable = null;
        this.pointers = []; // (name, val)
        this.matrixContainer = document.createElement('div');
        this.matrixContainer.className = 'viz-matrix-grid';
        this.container.appendChild(this.matrixContainer);

        this._toolbar = this._buildToolbar();
    }

    getToolbar() {
        return this._toolbar;
    }
    getParams() {
        return { rowLimit: this.rowLimit, colLimit: this.colLimit, rowBase: this.rowBase, colBase: this.colBase, pointers: this.pointers };
    }

    setParams({ rowLimit, colLimit, rowBase, colBase, pointers } = {}) {
        if (rowBase !== undefined) {
            this.rowBase = Math.max(0, parseInt(rowBase) || 0);
            if (this._rowBaseInput) this._rowBaseInput.value = this.rowBase === 0 ? '' : this.rowBase;
        }
        if (colBase !== undefined) {
            this.colBase = Math.max(0, parseInt(colBase) || 0);
            if (this._colBaseInput) this._colBaseInput.value = this.colBase === 0 ? '' : this.colBase;
        }
        if (rowLimit !== undefined) {
            this.rowLimit = rowLimit === null ? null : Math.max(0, parseInt(rowLimit) || 0);
            if (this._rowLimitInput) this._rowLimitInput.value = this.rowLimit === null ? '' : this.rowLimit;
        }
        if (colLimit !== undefined) {
            this.colLimit = colLimit === null ? null : Math.max(0, parseInt(colLimit) || 0);
            if (this._colLimitInput) this._colLimitInput.value = this.colLimit === null ? '' : this.colLimit;
        }
        if (pointers !== undefined) {
            this.pointers = pointers;
            this._syncPointersUI();
        }
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
            this.pointers.push({ name: '', rvalue: null, cvalue: null });
            this._syncPointersUI();
        });
        ptrSection.appendChild(addPtrBtn);
        toolbar.appendChild(ptrSection);

        return toolbar;
    }
    _syncPointersUI() {
        if (!this._pointersContainer) return;
        this._pointersContainer.innerHTML = '';
        this.pointers.forEach((ptr, idx) => {
            const row = this._mkPointerRow(ptr, idx);
            this._pointersContainer.appendChild(row);
        });
    }
    _mkPointerRow(ptr, idx) {
        const row = document.createElement('div');
        row.className = 'viz-ll-row';

        const pointInput = document.createElement('input');
        pointInput.type = 'text';
        pointInput.className = 'viz-ll-input';
        pointInput.placeholder = 'pointer name';
        pointInput.value = ptr.name;
        pointInput.addEventListener('mousedown', e => e.stopPropagation());
        pointInput.addEventListener('change', e => {
            this.pointers[idx].name = e.target.value.trim();
            this._render();
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'viz-ll-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('mousedown', e => e.stopPropagation());
        removeBtn.addEventListener('click', () => {
            this.pointers.splice(idx, 1);
            this._syncPointersUI();
            this._render();
        });

        row.appendChild(pointInput);
        row.appendChild(removeBtn);
        return row;
    }
    _createControl(toolbar, labelText, placeholder, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-matrix-control';

        const span = document.createElement('span');
        span.className = 'viz-ctrl-label';
        span.textContent = labelText + ': ';

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.className = 'viz-matrix-input';
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('change', (e) => onChange(e.target.value));

        group.appendChild(span);
        group.appendChild(input);
        toolbar.appendChild(group);
    }

    update(variable, allVariable) {
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
            }
            this.matrixContainer.appendChild(rowElement);
        }
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Matrix', MatrixVisualizer);
}