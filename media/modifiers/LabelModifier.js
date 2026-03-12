// @ts-nocheck
console.log('[YTP] LabelModifier.js loaded');

/**
 * Appends text labels to elements.
 * For an array variable: label[i] is appended to element i.
 * For a scalar variable: the value is appended to all elements.
 */
class LabelModifier extends BaseModifier {
    static acceptsType = 'array';

    constructor(settings = {}) {
        super({
            position: 'bottom', // 'top' | 'bottom' | 'right'
            color: '#ffd700',
            ...settings
        });
        this._createdLabels = [];
    }

    apply(elements, variableData) {
        if (!variableData || !elements || elements.length === 0) return;

        const labels = this._extractLabels(variableData, elements.length);
        if (!labels) return;

        const color = this.settings.color || '#ffd700';

        for (const el of elements) {
            const text = labels[el.index];
            if (text === undefined || text === null) continue;
            if (!el.domRef) continue;

            // SVG elements: append a <tspan> to the existing <text> inside the node group
            if (el.domRef instanceof SVGElement) {
                const NS = 'http://www.w3.org/2000/svg';
                const existingText = el.domRef.querySelector('text[text-anchor]');
                if (existingText) {
                    const tspan = document.createElementNS(NS, 'tspan');
                    tspan.setAttribute('x', '0');
                    tspan.setAttribute('dy', '1.2em');
                    tspan.setAttribute('fill', color);
                    tspan.setAttribute('font-size', '10');
                    tspan.setAttribute('font-weight', '600');
                    tspan.textContent = String(text);
                    existingText.appendChild(tspan);
                    this._createdLabels.push(tspan);
                }
                continue;
            }

            // HTML elements: append text inside .viz-array-value
            const valueEl = el.domRef.querySelector('.viz-array-value');
            if (valueEl) {
                const labelSpan = document.createElement('div');
                labelSpan.className = 'viz-modifier-label-inline';
                labelSpan.textContent = String(text);
                labelSpan.style.color = color;
                labelSpan.style.fontSize = '10px';
                labelSpan.style.fontWeight = '600';
                labelSpan.style.lineHeight = '1';
                valueEl.appendChild(labelSpan);
                this._createdLabels.push(labelSpan);
                continue;
            }

            // Fallback: append a span as a child of the domRef itself
            const labelSpan = document.createElement('div');
            labelSpan.className = 'viz-modifier-label-inline';
            labelSpan.textContent = String(text);
            labelSpan.style.color = color;
            labelSpan.style.fontSize = '10px';
            labelSpan.style.fontWeight = '600';
            el.domRef.appendChild(labelSpan);
            this._createdLabels.push(labelSpan);
        }
    }

    clear(elements) {
        for (const lbl of this._createdLabels) {
            lbl.remove();
        }
        this._createdLabels = [];
    }

    _extractLabels(variableData, count) {
        if (variableData.children && variableData.children.length > 0) {
            // Array: label[i] → element i
            const result = {};
            variableData.children.forEach((child, i) => {
                result[i] = child.value;
            });
            return result;
        }
        // Scalar: apply to all
        if (variableData.value !== undefined) {
            const result = {};
            for (let i = 0; i < count; i++) result[i] = variableData.value;
            return result;
        }
        return null;
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
        colorInput.value = this.settings.color || '#ffd700';
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
    modifierRegistry.register('label', LabelModifier);
}
