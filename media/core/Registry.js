// @ts-nocheck
console.log('[YTP] Registry.js loaded');

class VisualizerRegistry {
    constructor() {
        this.registry = new Map();
    }
    register(type, classRef) {
        this.registry.set(type, classRef);
    }
    create(type, container) {
        const ClassRef = this.registry.get(type) || this.registry.get('Text');
        return new ClassRef(container);
    }
    getAllTypes() {
        return Array.from(this.registry.keys());
    }
}
const visualizerRegistry = new VisualizerRegistry();
