// @ts-nocheck
console.log('[YTP] ColorModifier.js loaded');

/**
 * Maps element indices to colors from an array variable.
 * color[i] → element i gets that color as background/fill.
 * Supports numeric values mapped to a palette, or string hex colors.
 */
class ColorModifier extends BaseModifier {
    static acceptsType = 'array';

    constructor(settings = {}) {
        super({
            palette: 'heat',    // 'heat' | 'cool' | 'rainbow' | 'custom'
            opacity: 0.80,
            ...settings
        });
        this._appliedElements = [];
    }

    static PALETTES = {
        heat:    ['#440154','#482878','#3e4989','#31688e','#26828e','#1f9e89','#35b779','#6ece58','#b5de2b','#fde725'],
        cool:    ['#313695','#4575b4','#74add1','#abd9e9','#e0f3f8','#fee090','#fdae61','#f46d43','#d73027','#a50026'],
        rainbow: ['#e6194b','#f58231','#ffe119','#bfef45','#3cb44b','#42d4f4','#4363d8','#911eb4','#f032e6','#a9a9a9']
    };

    apply(elements, variableData) {
        if (!variableData || !elements || elements.length === 0) return;

        const colors = this._extractColors(variableData);
        if (!colors || colors.length === 0) return;

        const opacity = this.settings.opacity || 0.35;

        for (const el of elements) {
            if (el.index < 0 || el.index >= colors.length) continue;
            const color = colors[el.index];
            if (!color) continue;

            const dom = el.domRef;
            if (!dom) continue;

            // Check if SVG element or HTML element
            if (dom instanceof SVGElement) {
                // Target the first fillable shape child, not the <g> group
                const shape = dom.querySelector('rect, circle, path, ellipse') || dom;
                shape.style.fill = color;
                shape.style.fillOpacity = String(opacity);
                this._appliedElements.push({ domRef: shape, isSvg: true });
            } else {
                // Array boxes: highlight both index and value cells
                const indexEl = dom.querySelector('.viz-array-index');
                const valueEl = dom.querySelector('.viz-array-value');
                if (indexEl && valueEl) {
                    indexEl.style.backgroundColor = color;
                    indexEl.style.opacity = String(opacity);
                    valueEl.style.backgroundColor = color;
                    valueEl.style.opacity = String(opacity);
                    this._appliedElements.push({ domRef: indexEl, isSvg: false });
                    this._appliedElements.push({ domRef: valueEl, isSvg: false });
                } else {
                    dom.style.backgroundColor = color;
                    dom.style.setProperty('--modifier-bg-opacity', String(opacity));
                    this._appliedElements.push({ domRef: dom, isSvg: false });
                }
            }
        }
    }

    clear(elements) {
        for (const applied of this._appliedElements) {
            if (!applied.domRef) continue;
            if (applied.isSvg) {
                applied.domRef.style.fill = '';
                applied.domRef.style.fillOpacity = '';
            } else {
                applied.domRef.style.backgroundColor = '';
                applied.domRef.style.opacity = '';
                applied.domRef.style.removeProperty('--modifier-bg-opacity');
            }
        }
        this._appliedElements = [];
    }

    _extractColors(variableData) {
        // Array variable: children[i].value
        if (!variableData.children || variableData.children.length === 0) return null;

        const palette = ColorModifier.PALETTES[this.settings.palette] || ColorModifier.PALETTES.heat;
        return variableData.children.map(child => {
            const val = child.value;
            // If it's a hex color string, use directly
            if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) return val;
            // Numeric: map to palette
            const num = parseFloat(val);
            if (isNaN(num)) return null;
            const idx = Math.max(0, Math.min(palette.length - 1, Math.round(num) % palette.length));
            return palette[idx];
        });
    }

    getSettingsUI(onChange) {
        const container = document.createElement('div');
        container.className = 'modifier-settings';

        // Palette selector
        const palGroup = document.createElement('div');
        palGroup.className = 'viz-control';
        const palLabel = document.createElement('span');
        palLabel.className = 'viz-ctrl-label';
        palLabel.textContent = 'Palette: ';
        const palSelect = document.createElement('select');
        palSelect.className = 'viz-select';
        ['heat', 'cool', 'rainbow'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            if (p === this.settings.palette) opt.selected = true;
            palSelect.appendChild(opt);
        });
        palSelect.addEventListener('mousedown', e => e.stopPropagation());
        palSelect.addEventListener('change', () => {
            this.settings.palette = palSelect.value;
            if (onChange) onChange();
        });
        palGroup.appendChild(palLabel);
        palGroup.appendChild(palSelect);
        container.appendChild(palGroup);

        // Opacity slider
        const opGroup = document.createElement('div');
        opGroup.className = 'viz-control';
        const opLabel = document.createElement('span');
        opLabel.className = 'viz-ctrl-label';
        opLabel.textContent = 'Opacity: ';
        const opInput = document.createElement('input');
        opInput.type = 'range';
        opInput.min = '0.1'; opInput.max = '1'; opInput.step = '0.05';
        opInput.value = String(this.settings.opacity || 0.35);
        opInput.className = 'viz-input';
        opInput.addEventListener('mousedown', e => e.stopPropagation());
        opInput.addEventListener('input', () => {
            this.settings.opacity = parseFloat(opInput.value);
            if (onChange) onChange();
        });
        opGroup.appendChild(opLabel);
        opGroup.appendChild(opInput);
        container.appendChild(opGroup);

        return container;
    }
}

if (typeof modifierRegistry !== 'undefined') {
    modifierRegistry.register('color', ColorModifier);
}
