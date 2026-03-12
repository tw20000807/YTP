// @ts-nocheck
console.log('[YTP] PointerModifier.js loaded');

/**
 * Highlights the element whose index equals the bound scalar variable's value.
 * Kept as highlight-only to stay consistent across HTML/SVG visualizers.
 */
class PointerModifier extends BaseModifier {
    static acceptsType = 'scalar';

    constructor(settings = {}) {
        super({
            color: '#ff4444',
            ...settings
        });
        this._appliedElements = []; // track which elements we decorated
    }

    apply(elements, variableData) {
        if (!variableData || !elements || elements.length === 0) return;

        // Extract scalar value — the pointer index
        const idx = this._extractIndex(variableData);
        if (idx === null) return;

        const target = elements.find(el => el.index === idx);
        if (!target || !target.domRef) return;

        const color = this.settings.color || '#ff4444';

        // SVG elements: stroke-highlight the node shape (circle/rect/path), not outer group.
        if (target.domRef instanceof SVGElement) {
            const shape = target.domRef.querySelector('rect, circle, path, ellipse') || target.domRef;
            shape.setAttribute('data-mod-orig-stroke', shape.style.stroke || '');
            shape.setAttribute('data-mod-orig-stroke-width', shape.style.strokeWidth || '');
            shape.style.stroke = color;
            shape.style.strokeWidth = '3';
            this._appliedElements.push({ domRef: shape, style: 'svg-stroke' });
            return;
        }

        // HTML array boxes: highlight only the index cell.
        const indexEl = target.domRef.querySelector('.viz-array-index');
        if (indexEl) {
            indexEl.style.backgroundColor = color + '33';
            indexEl.style.boxShadow = `inset 0 0 0 2px ${color}`;
            this._appliedElements.push({ domRef: indexEl, style: 'highlight' });
            return;
        }

        // Generic HTML elements: highlight full element.
        target.domRef.style.backgroundColor = color + '33';
        target.domRef.style.boxShadow = `inset 0 0 0 2px ${color}`;
        this._appliedElements.push({ domRef: target.domRef, style: 'highlight' });
    }

    clear(elements) {
        for (const applied of this._appliedElements) {
            if (!applied.domRef) continue;
            if (applied.style === 'svg-stroke') {
                applied.domRef.style.stroke = applied.domRef.getAttribute('data-mod-orig-stroke') || '';
                applied.domRef.style.strokeWidth = applied.domRef.getAttribute('data-mod-orig-stroke-width') || '';
                applied.domRef.removeAttribute('data-mod-orig-stroke');
                applied.domRef.removeAttribute('data-mod-orig-stroke-width');
            } else if (applied.style === 'highlight') {
                applied.domRef.style.backgroundColor = '';
                applied.domRef.style.boxShadow = '';
            }
        }
        this._appliedElements = [];
    }

    _extractIndex(variableData) {
        // Scalar variable: variableData.value is the index
        const val = variableData.value;
        if (val === undefined || val === null) return null;
        const num = parseInt(val, 10);
        return isNaN(num) ? null : num;
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
        colorInput.value = this.settings.color || '#ff4444';
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
    modifierRegistry.register('pointer', PointerModifier);
}
