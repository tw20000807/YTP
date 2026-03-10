// @ts-nocheck
console.log('[YTP] BaseModifier.js loaded');

/**
 * Base class for all modifiers.
 * A modifier decorates a visualizer's rendered elements with additional
 * visual effects (pointers, colors, labels, ranges) driven by a separate variable.
 *
 * Element descriptor: { index: number, domRef: Element, text: string, rect?: {x,y,w,h} }
 */
class BaseModifier {
    /**
     * @param {Object} settings  Modifier-specific settings (style, color, palette, etc.)
     */
    constructor(settings = {}) {
        this.settings = { ...settings };
    }

    /**
     * Apply this modifier's visual effect to the rendered elements.
     * Subclasses override this.
     * @param {Array<{index:number, domRef:Element, text:string}>} elements
     * @param {Object|null} variableData  The bound variable's data from varMap
     */
    apply(elements, variableData) {}

    /**
     * Remove all visual effects previously applied by this modifier.
     * Called before re-applying or when the modifier is removed.
     * @param {Array<{index:number, domRef:Element}>} elements
     */
    clear(elements) {}

    /**
     * Build and return a DOM element for the modifier's settings panel.
     * Shown when the modifier row is expanded in the popup.
     * @param {Function} onChange  Callback to invoke when settings change
     * @returns {HTMLElement|null}
     */
    getSettingsUI(onChange) { return null; }

    /** @returns {Object} Plain object of current settings for persistence */
    getParams() { return { ...this.settings }; }

    /** @param {Object} params  Restore settings from persisted state */
    setParams(params) { if (params) this.settings = { ...this.settings, ...params }; }

    /** Clean up any resources */
    dispose() {}
}
