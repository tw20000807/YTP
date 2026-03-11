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

            // SVG elements: create an SVG <text> element
            if (el.domRef instanceof SVGElement && el.rect) {
                const NS = 'http://www.w3.org/2000/svg';
                const svgRoot = el.domRef.closest('svg');
                if (!svgRoot) continue;

                const labelEl = document.createElementNS(NS, 'text');
                labelEl.setAttribute('fill', color);
                labelEl.setAttribute('font-size', '10');
                labelEl.setAttribute('font-weight', '600');
                labelEl.setAttribute('text-anchor', 'middle');
                labelEl.setAttribute('pointer-events', 'none');
                labelEl.textContent = String(text);

                const pos = this.settings.position || 'bottom';
                if (pos === 'top') {
                    labelEl.setAttribute('x', el.rect.x + el.rect.w / 2);
                    labelEl.setAttribute('y', el.rect.y - 4);
                } else if (pos === 'right') {
                    labelEl.setAttribute('x', el.rect.x + el.rect.w + 4);
                    labelEl.setAttribute('y', el.rect.y + el.rect.h / 2);
                    labelEl.setAttribute('text-anchor', 'start');
                    labelEl.setAttribute('dominant-baseline', 'central');
                } else {
                    labelEl.setAttribute('x', el.rect.x + el.rect.w / 2);
                    labelEl.setAttribute('y', el.rect.y + el.rect.h + 12);
                }

                svgRoot.appendChild(labelEl);
                this._createdLabels.push(labelEl);
                continue;
            }

            // HTML elements
            const labelEl = document.createElement('span');
            labelEl.className = 'viz-modifier-label';
            labelEl.textContent = String(text);
            labelEl.style.color = color;
            labelEl.style.fontSize = '10px';
            labelEl.style.fontWeight = '600';
            labelEl.style.position = 'absolute';
            labelEl.style.pointerEvents = 'none';
            labelEl.style.whiteSpace = 'nowrap';

            const parent = el.domRef.parentElement;
            if (!parent) continue;
            parent.style.position = parent.style.position || 'relative';

            if (el.rect) {
                // Position relative to element rect
                const pos = this.settings.position || 'bottom';
                if (pos === 'top') {
                    labelEl.style.left = `${el.rect.x + el.rect.w / 2}px`;
                    labelEl.style.top = `${el.rect.y - 14}px`;
                    labelEl.style.transform = 'translateX(-50%)';
                } else if (pos === 'right') {
                    labelEl.style.left = `${el.rect.x + el.rect.w + 4}px`;
                    labelEl.style.top = `${el.rect.y + el.rect.h / 2}px`;
                    labelEl.style.transform = 'translateY(-50%)';
                } else {
                    labelEl.style.left = `${el.rect.x + el.rect.w / 2}px`;
                    labelEl.style.top = `${el.rect.y + el.rect.h + 2}px`;
                    labelEl.style.transform = 'translateX(-50%)';
                }
            } else {
                // HTML element: position using getBoundingClientRect
                const rect = el.domRef.getBoundingClientRect();
                const parentRect = parent.getBoundingClientRect();
                const pos = this.settings.position || 'bottom';
                if (pos === 'top') {
                    labelEl.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
                    labelEl.style.top = `${rect.top - parentRect.top - 14}px`;
                    labelEl.style.transform = 'translateX(-50%)';
                } else if (pos === 'right') {
                    labelEl.style.left = `${rect.right - parentRect.left + 4}px`;
                    labelEl.style.top = `${rect.top - parentRect.top + rect.height / 2}px`;
                    labelEl.style.transform = 'translateY(-50%)';
                } else {
                    labelEl.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
                    labelEl.style.top = `${rect.bottom - parentRect.top + 2}px`;
                    labelEl.style.transform = 'translateX(-50%)';
                }
            }

            parent.appendChild(labelEl);
            this._createdLabels.push(labelEl);
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

        // Position selector
        const posGroup = document.createElement('div');
        posGroup.className = 'viz-control';
        const posLabel = document.createElement('span');
        posLabel.className = 'viz-ctrl-label';
        posLabel.textContent = 'Position: ';
        const posSelect = document.createElement('select');
        posSelect.className = 'viz-select';
        ['top', 'bottom', 'right'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            if (p === this.settings.position) opt.selected = true;
            posSelect.appendChild(opt);
        });
        posSelect.addEventListener('mousedown', e => e.stopPropagation());
        posSelect.addEventListener('change', () => {
            this.settings.position = posSelect.value;
            if (onChange) onChange();
        });
        posGroup.appendChild(posLabel);
        posGroup.appendChild(posSelect);
        container.appendChild(posGroup);

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
