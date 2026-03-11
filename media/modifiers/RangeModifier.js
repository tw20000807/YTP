// @ts-nocheck
console.log('[YTP] RangeModifier.js loaded');

/**
 * Highlights all elements within an index range [lo, hi].
 * Requires two scalar variables bound as an array with 2 children,
 * or a single variable whose children[0] and children[1] are the bounds.
 */
class RangeModifier extends BaseModifier {
    static acceptsType = 'pair';

    constructor(settings = {}) {
        super({
            color: '#4fc3f7',
            opacity: 0.25,
            ...settings
        });
        this._appliedElements = [];
    }

    apply(elements, variableData) {
        if (!variableData || !elements || elements.length === 0) return;

        const range = this._extractRange(variableData);
        if (!range) return;
        const { lo, hi } = range;

        const color = this.settings.color || '#4fc3f7';
        const opacity = this.settings.opacity || 0.25;
        for (const el of elements) {
            if (el.index < lo || el.index > hi) continue;
            if (!el.domRef) continue;

            if (el.domRef instanceof SVGElement) {
                // Target the first fillable shape child, not the <g> group
                const shape = el.domRef.querySelector('rect, circle, path, ellipse') || el.domRef;
                shape.style.fill = color;
                shape.style.fillOpacity = String(opacity);
                this._appliedElements.push({ domRef: shape, style: 'highlight', isSvg: true });
            } else {
                // Array boxes: highlight both index and value cells
                const indexEl = el.domRef.querySelector('.viz-array-index');
                const valueEl = el.domRef.querySelector('.viz-array-value');
                if (indexEl && valueEl) {
                    const bg = `rgba(${this._hexToRgb(color)}, ${opacity})`;
                    indexEl.style.backgroundColor = bg;
                    indexEl.style.boxShadow = `inset 0 0 0 1px ${color}`;
                    valueEl.style.backgroundColor = bg;
                    valueEl.style.boxShadow = `inset 0 0 0 1px ${color}`;
                    this._appliedElements.push({ domRef: indexEl, style: 'highlight', isSvg: false });
                    this._appliedElements.push({ domRef: valueEl, style: 'highlight', isSvg: false });
                } else {
                    el.domRef.style.backgroundColor = color;
                    el.domRef.style.opacity = '';
                    el.domRef.style.boxShadow = `inset 0 0 0 1000px rgba(${this._hexToRgb(color)}, ${opacity})`;
                    this._appliedElements.push({ domRef: el.domRef, style: 'highlight', isSvg: false });
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
                applied.domRef.style.boxShadow = '';
            }
        }
        this._appliedElements = [];
    }

    _extractRange(variableData) {
        // Array with 2 children: [lo, hi]
        if (variableData.children && variableData.children.length >= 2) {
            const lo = parseInt(variableData.children[0].value, 10);
            const hi = parseInt(variableData.children[1].value, 10);
            if (!isNaN(lo) && !isNaN(hi)) return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
        }
        // Single scalar with comma: "2,5"
        if (variableData.value && typeof variableData.value === 'string') {
            const parts = variableData.value.split(',').map(s => parseInt(s.trim(), 10));
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return { lo: Math.min(parts[0], parts[1]), hi: Math.max(parts[0], parts[1]) };
            }
        }
        return null;
    }

    _hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r},${g},${b}`;
    }

    getSettingsUI(onChange) {
        const container = document.createElement('div');
        container.className = 'modifier-settings';

        // Color picker
        const colorGroup = document.createElement('div');
        colorGroup.className = 'viz-control';
        const colorLabel = document.createElement('span');
        colorLabel.className = 'viz-ctrl-label';
        colorLabel.textContent = 'Color: ';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this.settings.color || '#4fc3f7';
        colorInput.className = 'viz-input';
        colorInput.addEventListener('mousedown', e => e.stopPropagation());
        colorInput.addEventListener('input', () => {
            this.settings.color = colorInput.value;
            if (onChange) onChange();
        });
        colorGroup.appendChild(colorLabel);
        colorGroup.appendChild(colorInput);
        container.appendChild(colorGroup);

        return container;
    }
}

if (typeof modifierRegistry !== 'undefined') {
    modifierRegistry.register('range', RangeModifier);
}
