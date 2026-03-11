// @ts-nocheck
console.log('[YTP] BarVisualizer.js loaded - Auto Zero-Line Version');

class BarVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.base = 0;
        this.limit = null;
        this.variable = null;
        this._prevValues = new Map();
        
        this.allVariable = null;
        this.pointers = [];
        
        this.barContainer = document.createElement('div');
        this.barContainer.className = 'viz-bar-container';
        this.container.appendChild(this.barContainer);
        
        this._toolbar = this._buildToolbar();
    }
    
    getToolbar() {
        return this._toolbar;
    }
    getParams() {
        return { base: this.base, limit: this.limit, pointers: this.pointers };
    }

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

    _render() {
        this.barContainer.innerHTML = '';
        
        if (!this.variable || !this.variable.children || this.variable.children.length === 0) {
            this.barContainer.innerHTML = '<div class="viz-bar-empty">No Data</div>';
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
        const displayItems = children.slice(start, end + 1);
        const values = displayItems.map(c => parseFloat(c.value) || 0);

        const maxVal = Math.max(...values, 0);
        const minVal = Math.min(...values, 0);
        const range = maxVal - minVal || 1; 

        const zeroBottomPct = ((0 - minVal) / range) * 100;

        displayItems.forEach((child, idx) => {
            const actualIndex = start + idx;
            const val = parseFloat(child.value) || 0;
            const isChanged = this._prevValues.has(actualIndex) && this._prevValues.get(actualIndex) !== child.value;

            const matchedPointers = this.pointers.filter(p => p.value === actualIndex);

            const barUnit = document.createElement('div');
            barUnit.className = 'viz-bar-unit';

            const valLabel = document.createElement('div');
            valLabel.className = 'viz-bar-value ' + (isChanged ? ' viz-bar-value--changed' : '');;
            valLabel.textContent = child.value;

            const barWrapper = document.createElement('div');
            barWrapper.className = 'viz-bar-wrapper';

            const zeroLine = document.createElement('div');
            zeroLine.className = 'viz-zero-line';
            zeroLine.style.bottom = `${zeroBottomPct}%`;
            barWrapper.appendChild(zeroLine);

            const barInner = document.createElement('div');
            const heightPct = (Math.abs(val) / range) * 100;
            
            barInner.className = `viz-bar-inner ${val >= 0 ? 'pos' : 'neg'}${isChanged ? ' changed' : ''}`;
            barInner.style.height = `${heightPct}%`;
            
            if (val >= 0) {
                barInner.style.bottom = `${zeroBottomPct}%`;
                barInner.style.borderRadius = '2px 2px 0 0';
            } else {
                barInner.style.top = `${100 - zeroBottomPct}%`;
                barInner.style.borderRadius = '0 0 2px 2px';
            }
            barWrapper.appendChild(barInner);
            const indexLabel = document.createElement('div');
            indexLabel.className = 'viz-bar-index'+ (matchedPointers.length > 0 ? ' viz-bar-index--pointer' : '');
            indexLabel.textContent = matchedPointers.length > 0 ? matchedPointers.map(p => p.name).join(',') : actualIndex;

            barUnit.appendChild(valLabel);
            barUnit.appendChild(barWrapper);
            barUnit.appendChild(indexLabel);
            this.barContainer.appendChild(barUnit);
        });
    }


    _createControl(toolbar, labelText, initialValue, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-bar-control';
        const span = document.createElement('span');
        span.textContent = labelText + ': ';
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'viz-bar-input';
        input.placeholder = labelText === 'Limit' ? 'all' : '0';
        input.addEventListener('mousedown', e => e.stopPropagation());
        input.addEventListener('change', e => onChange(e.target.value));
        group.appendChild(span);
        group.appendChild(input);
        toolbar.appendChild(group);
        return input;
    }

    onContainerResize() { this._render(); }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('bar', BarVisualizer);
}