// @ts-nocheck
console.log('[YTP] BaseVisualizer.js loaded');

class BaseVisualizer {
    constructor(container) {
        this.container = container;
    }
    update(variable) {}
    /**
     * Override to return a DOM element that will be inserted as a toolbar row
     * between the block header and block content. Return null for no toolbar.
     * @returns {HTMLElement|null}
     */
    getToolbar() { return null; }
    dispose() {}
}
