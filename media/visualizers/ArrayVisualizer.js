// @ts-nocheck
console.log('[YTP] ArrayVisualizer.js loaded');

class ArrayVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.base = 0;
        this.limit = null; // null = show all (inclusive end index)
        this.allVariable = null;
        this.variable = null;
        this._prevValues = new Map(); // index -> previous value string
        this._dynBoxW = null; // dynamic box width set by onContainerResize
        this._dynBoxH = null; // dynamic box height set by onContainerResize

        this.pointers = []; // (name, val)
        // Content area: connected boxes
        this.arrayBoxContainer = document.createElement('div');
        this.arrayBoxContainer.className = 'viz-array-container';
        this.container.appendChild(this.arrayBoxContainer);

        // Build toolbar element (returned via getToolbar, inserted by Manager)
        this._toolbar = this._buildToolbar();
    }

    /**
     * Called by Manager after instantiation.
     * Returns the toolbar DOM node to be inserted as .block-toolbar.
     * @returns {HTMLElement}
     */
    getToolbar() {
        return this._toolbar;
    }

    getParams() {
        return { base: this.base, limit: this.limit, pointers: this.pointers };
    }

    /** Restore state. Does NOT render — caller invokes update() afterwards. */
    setParams({ base, limit, pointers } = {}) {
        if (base !== undefined) {
            this.base = Math.max(0, parseInt(base) || 0);
            if (this._baseInput) this._baseInput.value = this.base === 0 ? '' : this.base;
        }
        if (limit !== undefined) {
            this.limit = limit === null ? null : Math.max(0, parseInt(limit) || 0);
            if (this._limitInput) this._limitInput.value = this.limit === null ? '' : this.limit;
        }
        if (pointers !== undefined) {
            this.pointers = pointers;
            this._syncPointersUI();
        }
    }

    _buildToolbar() {
        const toolbar = document.createElement('div');

        this._baseInput = this._createControl(toolbar, 'Base', '', (val) => {
            this.base = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            this._render();
        });

        this._limitInput = this._createControl(toolbar, 'Limit', '', (val) => {
            this.limit = val === '' ? null : Math.max(0, parseInt(val) || 0);
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
            this.pointers.push({ name: '', value: null });
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

    _createControl(toolbar, labelText, initialValue, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-array-control';

        const span = document.createElement('span');
        span.className = 'viz-ctrl-label';
        span.textContent = labelText + ': ';

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = labelText === 'Limit' ? 'all' : '0';
        input.value = initialValue;
        input.className = 'viz-array-input';
        // Prevent drag-start on the block when clicking into the input
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('change', (e) => onChange(e.target.value));

        group.appendChild(span);
        group.appendChild(input);
        toolbar.appendChild(group);
        return input;
    }

    update(variable, allVariable) {
        // Snapshot previous values keyed by index before overwriting
        this._prevValues = new Map();
        if (this.variable && this.variable.children) {
            this.variable.children.forEach((c, i) => this._prevValues.set(i, c.value));
        }
        this.allVariable = allVariable;
        this.variable = variable;
        
        this._render();
        
    }

    _rangeBounds(total) {
        const start = Math.min(Math.max(0, this.base), Math.max(0, total - 1));
        const end = this.limit === null
            ? Math.max(0, total - 1)
            : Math.min(Math.max(0, this.limit), Math.max(0, total - 1));
        return { start, end };
    }

    /** Called by Manager when the block is resized by the user. */
    onContainerResize(w, h) {
        if (!w || w <= 0 || !h || h <= 0) return;
        const children = this.variable && this.variable.children ? this.variable.children : [];
        if (children.length === 0) return;

        const { start, end } = this._rangeBounds(children.length);
        if (end < start) return;
        const N = end - start + 1;

        // viz-array-container has no padding
        const availW = w;
        const availH = h;

        // Pure optimizer: maximize min(h/rows, w/ceil(N/rows)) over rows in [1, N].
        const BOX_H = 52;
        let bestRows = 1;
        let bestScore = -Infinity;
        for (let rows = 1; rows <= N; rows++) {
            const cols = Math.ceil(N / rows);
            const score = Math.min(availH / rows, availW / cols);
            if (score > bestScore || (Math.abs(score - bestScore) < 1e-9 && rows < bestRows)) {
                bestScore = score;
                bestRows = rows;
            }
        }

        const targetCols = Math.ceil(N / bestRows);
        const boxW = Math.floor((availW + targetCols - 1) / targetCols);
        const boxH = Math.floor(availH / bestRows);
        this._dynBoxW = `${boxW}px`;
        this._dynBoxH = `${boxH}px`;

        const fontScale = Math.max(0.55, Math.min(1.25, Math.min(boxW, boxH) / 44));
        this.arrayBoxContainer.style.fontSize = `${fontScale}em`;
        this._render();
    }

    _render() {
        this.arrayBoxContainer.innerHTML = '';

        if (!this.variable || !this.variable.children || this.variable.children.length === 0) {
            const msg = document.createElement('span');
            msg.className = 'viz-array-empty';
            msg.textContent = this.variable ? '(empty array)' : 'No data';
            this.arrayBoxContainer.appendChild(msg);
            return;
        }
        if (this.allVariable && this.pointers.length > 0) {
            this.pointers.forEach(ptr => {
                const v = this.allVariable.get(ptr.name);
                ptr.value = null;
                if (v) {
                    const idx = parseInt(v.value);
                    if (!isNaN(idx)) {
                        ptr.value = idx;
                    }
                }
            });
        }

        const children = this.variable.children;
        const { start, end } = this._rangeBounds(children.length);
        if (end < start) return;

        
        for (let i = start; i <= end; i++) {
            const child = children[i];
            const box = document.createElement('div');
            const changed = this._prevValues.size > 0 && this._prevValues.get(i) !== child.value;
            box.className = 'viz-array-box' + (changed ? ' viz-array-box--changed' : '');
            // Apply dynamic width determined by onContainerResize
            if (this._dynBoxW) {
                box.style.width = this._dynBoxW;
                box.style.flex = `0 0 ${this._dynBoxW}`;
            }
            if (this._dynBoxH) {
                box.style.height = this._dynBoxH;
            }
            const matchedPointers = this.pointers.filter(p => p.value === i);
            

            const indexEl = document.createElement('div');
            indexEl.className = 'viz-array-index' + (matchedPointers.length > 0 ? ' viz-array-index--pointer' : '');
            indexEl.textContent = matchedPointers.length > 0 ? matchedPointers.map(p => p.name).join(',') : i;

            const valueEl = document.createElement('div');
            valueEl.className = 'viz-array-value';
            valueEl.textContent = child.value;
            if (child.type) valueEl.title = child.type;

            box.appendChild(indexEl);
            box.appendChild(valueEl);
            this.arrayBoxContainer.appendChild(box);
        }
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('array', ArrayVisualizer);
}