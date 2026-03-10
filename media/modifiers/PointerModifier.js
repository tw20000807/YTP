// @ts-nocheck
console.log('[YTP] PointerModifier.js loaded');

/**
 * Highlights the element whose index equals the bound scalar variable's value.
 * Draws a colored arrow marker above the element, or applies a colored border.
 */
class PointerModifier extends BaseModifier {
    constructor(settings = {}) {
        super({
            style: 'arrow',       // 'arrow' | 'border' | 'highlight'
            color: '#ff4444',
            label: '',            // optional label shown on the pointer
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

        const style = this.settings.style || 'arrow';
        const color = this.settings.color || '#ff4444';

        // SVG elements: use stroke highlight (HTML arrow/highlight won't render in SVG)
        if (target.domRef instanceof SVGElement) {
            const shape = target.domRef.querySelector('rect, circle, path, ellipse') || target.domRef;
            shape.setAttribute('data-mod-orig-stroke', shape.getAttribute('stroke') || '');
            shape.setAttribute('data-mod-orig-stroke-width', shape.getAttribute('stroke-width') || '');
            shape.setAttribute('stroke', color);
            shape.setAttribute('stroke-width', '3');
            this._appliedElements.push({ domRef: shape, style: 'svg-stroke' });
            return;
        }

        if (style === 'border') {
            target.domRef.style.outline = `3px solid ${color}`;
            target.domRef.style.outlineOffset = '-1px';
            this._appliedElements.push({ domRef: target.domRef, style: 'border' });
        } else if (style === 'highlight') {
            target.domRef.style.backgroundColor = color + '33'; // 20% opacity
            target.domRef.style.boxShadow = `inset 0 0 0 2px ${color}`;
            this._appliedElements.push({ domRef: target.domRef, style: 'highlight' });
        } else {
            // Arrow: add an SVG or HTML arrow marker above the element
            this._addArrowMarker(target, color);
        }
    }

    clear(elements) {
        for (const applied of this._appliedElements) {
            if (!applied.domRef) continue;
            if (applied.style === 'svg-stroke') {
                applied.domRef.setAttribute('stroke', applied.domRef.getAttribute('data-mod-orig-stroke') || '');
                applied.domRef.setAttribute('stroke-width', applied.domRef.getAttribute('data-mod-orig-stroke-width') || '');
                applied.domRef.removeAttribute('data-mod-orig-stroke');
                applied.domRef.removeAttribute('data-mod-orig-stroke-width');
            } else if (applied.style === 'border') {
                applied.domRef.style.outline = '';
                applied.domRef.style.outlineOffset = '';
            } else if (applied.style === 'highlight') {
                applied.domRef.style.backgroundColor = '';
                applied.domRef.style.boxShadow = '';
            } else if (applied.style === 'arrow' && applied.marker) {
                applied.marker.remove();
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

    _addArrowMarker(target, color) {
        const domRef = target.domRef;
        const parent = domRef.parentElement;
        if (!parent) return;

        const marker = document.createElement('div');
        marker.className = 'viz-pointer-arrow';
        marker.style.color = color;
        marker.textContent = '▼';
        if (this.settings.label) {
            const lbl = document.createElement('span');
            lbl.className = 'viz-pointer-label';
            lbl.textContent = this.settings.label;
            lbl.style.color = color;
            marker.insertBefore(lbl, marker.firstChild);
        }

        // Position the arrow above the target element
        // For SVG elements, use rect data if available
        if (target.rect) {
            marker.style.position = 'absolute';
            marker.style.left = `${target.rect.x + target.rect.w / 2}px`;
            marker.style.top = `${target.rect.y - 18}px`;
            marker.style.transform = 'translateX(-50%)';
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(marker);
        } else {
            // HTML elements: insert before the target
            marker.style.display = 'flex';
            marker.style.flexDirection = 'column';
            marker.style.alignItems = 'center';
            marker.style.position = 'absolute';
            const rect = domRef.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            marker.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
            marker.style.top = `${rect.top - parentRect.top - 18}px`;
            marker.style.transform = 'translateX(-50%)';
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(marker);
        }

        this._appliedElements.push({ domRef, style: 'arrow', marker });
    }

    getSettingsUI(onChange) {
        const container = document.createElement('div');
        container.className = 'modifier-settings';

        // Style selector
        const styleGroup = document.createElement('div');
        styleGroup.className = 'viz-control';
        const styleLabel = document.createElement('span');
        styleLabel.className = 'viz-ctrl-label';
        styleLabel.textContent = 'Style: ';
        const styleSelect = document.createElement('select');
        styleSelect.className = 'viz-select';
        ['arrow', 'border', 'highlight'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            if (s === this.settings.style) opt.selected = true;
            styleSelect.appendChild(opt);
        });
        styleSelect.addEventListener('mousedown', e => e.stopPropagation());
        styleSelect.addEventListener('change', () => {
            this.settings.style = styleSelect.value;
            if (onChange) onChange();
        });
        styleGroup.appendChild(styleLabel);
        styleGroup.appendChild(styleSelect);
        container.appendChild(styleGroup);

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
