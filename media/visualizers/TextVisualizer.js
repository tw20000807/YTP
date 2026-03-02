// @ts-nocheck
console.log('[YTP] TextVisualizer.js loaded');

class TextVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.pre = document.createElement('div');
        this.pre.className = 'viz-text';
        this.container.appendChild(this.pre);
    }
    update(variable) {
        this.pre.textContent = variable.value;
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Text', TextVisualizer);
}
