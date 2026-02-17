// @ts-nocheck
console.log('[YTP] TableVisualizer.js loaded');

class TableVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this.div = document.createElement('div');
        this.div.textContent = "Table View (Not Implemented)";
        this.div.style.fontStyle = 'italic';
        this.div.style.color = '#888';
        this.container.appendChild(this.div);
    }
}
if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Table', TableVisualizer);
}
