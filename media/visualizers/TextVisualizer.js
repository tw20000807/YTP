// @ts-nocheck
console.log('[YTP] TextVisualizer.js loaded');

class TextVisualizer extends BaseVisualizer {
    constructor(container) {
        super(container);
        this._prevValue = undefined;
        this.pre = document.createElement('div');
        this.pre.className = 'viz-text';
        this.container.appendChild(this.pre);
    }
    update(variable) {
        const newValue = variable.value;
        if (this._prevValue !== undefined && this._prevValue !== newValue) {
            // Flash highlight on change
            this.pre.classList.remove('viz-text--changed');
            // Force reflow so removing + re-adding restarts the animation
            void this.pre.offsetWidth;
            this.pre.classList.add('viz-text--changed');
        }
        this._prevValue = newValue;
        this.pre.textContent = newValue;
    }
}

if (typeof visualizerRegistry !== 'undefined') {
    visualizerRegistry.register('Text', TextVisualizer);
}
