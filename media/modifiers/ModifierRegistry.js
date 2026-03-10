// @ts-nocheck
console.log('[YTP] ModifierRegistry.js loaded');

/**
 * Simple type→class registry for modifiers.
 * Mirrors the pattern used by visualizerRegistry.
 */
class ModifierRegistry {
    constructor() {
        /** @type {Map<string, typeof BaseModifier>} */
        this.registry = new Map();
    }
    /** @param {string} type  @param {typeof BaseModifier} cls */
    register(type, cls) {
        this.registry.set(type, cls);
        console.log(`[YTP] Modifier registered: ${type}`);
    }
    /** @param {string} type  @returns {typeof BaseModifier|null} */
    get(type) {
        return this.registry.get(type) || null;
    }
    /** @returns {string[]} */
    getAllTypes() {
        return Array.from(this.registry.keys());
    }
}

const modifierRegistry = new ModifierRegistry();
