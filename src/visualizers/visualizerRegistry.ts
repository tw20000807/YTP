import { IVisualizer } from './visualizer.interface';
import { VariableData } from '../debugProxy';
import { ArrayVisualizer } from './arrayVisualizer';
import { PrimitiveVisualizer } from './primitiveVisualizer';

/**
 * Registry to manage all available visualizers.
 * Allows the user to choose which visualizer to use for a given variable.
 */
export class VisualizerRegistry {
    private visualizers: IVisualizer[] = [];

    constructor() {
        // Register default visualizers
        this.register(new ArrayVisualizer());
        this.register(new PrimitiveVisualizer());
        // Future: this.register(new MatrixVisualizer());
        // Future: this.register(new TreeVisualizer());
    }

    /**
     * Register a new visualizer module
     */
    public register(visualizer: IVisualizer): void {
        this.visualizers.push(visualizer);
    }

    /**
     * Get all visualizers that can handle the given variable.
     * This allows the UI to show a dropdown/selection if multiple visualizers apply.
     */
    public getCompatibleVisualizers(variable: VariableData): IVisualizer[] {
        return this.visualizers.filter(v => v.canHandle(variable));
    }

    /**
     * Get a specific visualizer by ID
     */
    public getVisualizer(id: string): IVisualizer | undefined {
        return this.visualizers.find(v => v.id === id);
    }
}
