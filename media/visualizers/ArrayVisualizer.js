// @ts-nocheck
console.log('[YTP] ArrayVisualizer.js loaded');

class ArrayVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.base = 0;
        this.limit = null; // null = show all
        this.variable = null;
        this._prevValues = new Map(); // index -> previous value string

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
        return { base: this.base, limit: this.limit };
    }

    /** Restore state. Does NOT render — caller invokes update() afterwards. */
    setParams({ base, limit } = {}) {
        if (base !== undefined) {
            this.base = Math.max(0, parseInt(base) || 0);
            if (this._baseInput) this._baseInput.value = this.base === 0 ? '' : this.base;
        }
        if (limit !== undefined) {
            this.limit = limit === null ? null : Math.max(1, parseInt(limit) || 1);
            if (this._limitInput) this._limitInput.value = this.limit === null ? '' : this.limit;
        }
    }

    _buildToolbar() {
        const toolbar = document.createElement('div');

        this._baseInput = this._createControl(toolbar, 'Base', '', (val) => {
            this.base = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
            this._render();
        });

        this._limitInput = this._createControl(toolbar, 'Limit', '', (val) => {
            this.limit = val === '' ? null : Math.max(1, parseInt(val) || 1);
            this._render();
        });

        return toolbar;
    }

    _createControl(toolbar, labelText, initialValue, onChange) {
        const group = document.createElement('div');
        group.className = 'viz-array-control';

        const label = document.createElement('label');
        label.textContent = labelText + ': ';

        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = labelText === 'Limit' ? 'all' : '0';
        input.value = initialValue;
        input.className = 'viz-array-input';
        // Prevent drag-start on the block when clicking into the input
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('change', (e) => onChange(e.target.value));

        label.appendChild(input);
        group.appendChild(label);
        toolbar.appendChild(group);
        return input;
    }

    update(variable) {
        // Snapshot previous values keyed by index before overwriting
        this._prevValues = new Map();
        if (this.variable && this.variable.children) {
            this.variable.children.forEach((c, i) => this._prevValues.set(i, c.value));
        }
        this.variable = variable;
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

        const children = this.variable.children;
        const start = this.base;
        // If limit is null (empty input), show the entire array from base
        const end = this.limit === null
            ? children.length
            : Math.min(children.length, start + this.limit);

        for (let i = start; i < end; i++) {
            const child = children[i];

            const box = document.createElement('div');
            const changed = this._prevValues.size > 0 && this._prevValues.get(i) !== child.value;
            box.className = 'viz-array-box' + (changed ? ' viz-array-box--changed' : '');

            const indexEl = document.createElement('div');
            indexEl.className = 'viz-array-index';
            indexEl.textContent = i;

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
