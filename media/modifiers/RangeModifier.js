// @ts-nocheck
console.log('[YTP] RangeModifier.js loaded');

/**
 * Highlights all elements within an index range defined by two scalar
 * integer variables (l and r).  Both variable paths are stored in settings
 * (loVarPath, hiVarPath) and looked up from varMap at apply time.
 * A bracket-type setting controls inclusive/exclusive endpoints:
 *   '[,]'  →  l ≤ index ≤ r
 *   '(,)'  →  l < index < r
 *   '[,)'  →  l ≤ index < r
 *   '(,]'  →  l < index ≤ r
 */
class RangeModifier extends BaseModifier {
    static acceptsType = 'scalar';

    constructor(settings = {}) {
        super({
            color: '#4fc3f7',
            opacity: 0.25,
            loVarPath: settings.loVarPath || '',
            hiVarPath: settings.hiVarPath || '',
            bracketType: settings.bracketType || '[,]',
            ...settings
        });
        this._appliedElements = [];
    }

    apply(elements, variableData, varMap) {
        if (!elements || elements.length === 0 || !varMap) return;

        const range = this._extractRange(varMap);
        if (!range) return;
        const { lo, hi, loInclusive, hiInclusive } = range;

        const color = this.settings.color || '#4fc3f7';
        const opacity = this.settings.opacity || 0.25;
        for (const el of elements) {
            const idx = el.index;
            const aboveLo = loInclusive ? idx >= lo : idx > lo;
            const belowHi = hiInclusive ? idx <= hi : idx < hi;
            if (!aboveLo || !belowHi) continue;
            if (!el.domRef) continue;

            if (el.domRef instanceof SVGElement) {
                const shape = el.domRef.querySelector('rect, circle, path, ellipse') || el.domRef;
                shape.style.fill = color;
                shape.style.fillOpacity = String(opacity);
                this._appliedElements.push({ domRef: shape, style: 'highlight', isSvg: true });
            } else {
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

    _extractRange(varMap) {
        const loPath = this.settings.loVarPath;
        const hiPath = this.settings.hiVarPath;
        if (!loPath || !hiPath) return null;

        const loVar = varMap.get(loPath);
        const hiVar = varMap.get(hiPath);
        if (!loVar || !hiVar) return null;

        const lo = parseInt(loVar.value, 10);
        const hi = parseInt(hiVar.value, 10);
        if (isNaN(lo) || isNaN(hi)) return null;

        const bt = this.settings.bracketType || '[,]';
        const loInclusive = bt.charAt(0) === '[';
        const hiInclusive = bt.charAt(bt.length - 1) === ']';

        return {
            lo: Math.min(lo, hi),
            hi: Math.max(lo, hi),
            loInclusive,
            hiInclusive
        };
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

        const getVarOpts = () => {
            if (!window.controller || !window.controller.varMap) return [];
            return Array.from(window.controller.varMap.keys()).sort();
        };

        // L (lo) variable path
        const loGroup = document.createElement('div');
        loGroup.className = 'viz-control';
        const loLabel = document.createElement('span');
        loLabel.className = 'viz-ctrl-label';
        loLabel.textContent = 'L: ';
        const loInput = document.createElement('input');
        loInput.type = 'text';
        loInput.className = 'viz-input';
        loInput.placeholder = 'l variable';
        loInput.value = this.settings.loVarPath || '';
        loInput.addEventListener('mousedown', e => e.stopPropagation());
        loInput.addEventListener('change', () => {
            this.settings.loVarPath = loInput.value.trim();
            if (onChange) onChange();
        });
        if (typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(loInput, getVarOpts, { matchMode: 'prefix', sort: true, resetScrollOnShow: true });
        }
        loGroup.appendChild(loLabel);
        loGroup.appendChild(loInput);
        container.appendChild(loGroup);

        // R (hi) variable path
        const hiGroup = document.createElement('div');
        hiGroup.className = 'viz-control';
        const hiLabel = document.createElement('span');
        hiLabel.className = 'viz-ctrl-label';
        hiLabel.textContent = 'R: ';
        const hiInput = document.createElement('input');
        hiInput.type = 'text';
        hiInput.className = 'viz-input';
        hiInput.placeholder = 'r variable';
        hiInput.value = this.settings.hiVarPath || '';
        hiInput.addEventListener('mousedown', e => e.stopPropagation());
        hiInput.addEventListener('change', () => {
            this.settings.hiVarPath = hiInput.value.trim();
            if (onChange) onChange();
        });
        if (typeof CustomDropdown !== 'undefined') {
            CustomDropdown.attach(hiInput, getVarOpts, { matchMode: 'prefix', sort: true, resetScrollOnShow: true });
        }
        hiGroup.appendChild(hiLabel);
        hiGroup.appendChild(hiInput);
        container.appendChild(hiGroup);

        // Bracket type dropdown
        const btGroup = document.createElement('div');
        btGroup.className = 'viz-control';
        const btLabel = document.createElement('span');
        btLabel.className = 'viz-ctrl-label';
        btLabel.textContent = 'Range: ';
        const btSel = document.createElement('select');
        btSel.className = 'viz-select';
        const options = ['[l,r]', '(l,r)', '[l,r)', '(l,r]'];
        const values  = ['[,]',  '(,)',   '[,)',   '(,]'];
        options.forEach((label, i) => {
            const opt = document.createElement('option');
            opt.value = values[i];
            opt.textContent = label;
            if (values[i] === (this.settings.bracketType || '[,]')) opt.selected = true;
            btSel.appendChild(opt);
        });
        btSel.addEventListener('mousedown', e => e.stopPropagation());
        btSel.addEventListener('change', () => {
            this.settings.bracketType = btSel.value;
            if (onChange) onChange();
        });
        btGroup.appendChild(btLabel);
        btGroup.appendChild(btSel);
        container.appendChild(btGroup);

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
