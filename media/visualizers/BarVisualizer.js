// @ts-nocheck
console.log('[YTP] BarVisualizer.js loaded - Auto Zero-Line Version');

class BarVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.base = 0;
        this.limit = null;
        this.variable = null;
        this._prevValues = new Map();

        this.barContainer = document.createElement('div');
        this.barContainer.className = 'viz-bar-container';
        this.container.appendChild(this.barContainer);

        this._toolbar = this._buildToolbar();
    }

    getToolbar() {
        return this._toolbar;
    }

    update(variable) {
        this._prevValues = new Map();
        if (this.variable && this.variable.children) {
            this.variable.children.forEach((c, i) => this._prevValues.set(i, c.value));
        }
        
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
            this.barContainer.innerHTML = '<div class="viz-array-empty">No Data</div>';
            return;
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

            const barUnit = document.createElement('div');
            barUnit.className = 'viz-bar-unit';

            const valLabel = document.createElement('div');
            valLabel.className = 'viz-bar-value';
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
            indexLabel.className = 'viz-bar-index';
            indexLabel.textContent = actualIndex;

            barUnit.appendChild(valLabel);
            barUnit.appendChild(barWrapper);
            barUnit.appendChild(indexLabel);
            this.barContainer.appendChild(barUnit);
        });
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
        return toolbar;
    }

    _createControl(toolbar, labelText, initialValue, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-array-control';
        const span = document.createElement('span');
        span.textContent = labelText + ': ';
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'viz-array-input';
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