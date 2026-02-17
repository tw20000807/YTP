// @ts-nocheck
console.log('[YTP] JsonVisualizer.js loaded');

class JsonVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.pre = document.createElement('pre');
        this.pre.style.margin = '0';
        this.pre.style.fontSize = '0.9em';
        this.container.appendChild(this.pre);
    }
    update(variable) {
        const reconstruct = (v) => {
            if (!v.children || v.children.length === 0) return v.value;
            const obj = {};
            v.children.forEach(c => {
                 obj[c.name] = reconstruct(c);
            });
            return obj;
        };
        const data = reconstruct(variable);
        this.pre.textContent = JSON.stringify(data, null, 2);
    }
}
if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('JSON', JsonVisualizer);
}
