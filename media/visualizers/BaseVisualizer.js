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
    /**
     * Return a plain object of all user-configurable state (toolbar settings).
     * Used by Manager to persist settings across uncheck/recheck and panel restarts.
     * @returns {Object}
     */
    getParams() { return {}; }
    /**
     * Restore state from a plain object previously returned by getParams().
     * Should update internal state AND sync all toolbar UI controls.
     * Must NOT trigger a render — Manager calls update() after this.
     * @param {Object} params
     */
    setParams(params) {}
    dispose() {}
}
