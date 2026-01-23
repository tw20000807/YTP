import { VariableData } from '../debugProxy';

/**
 * Interface for all interactive visualizers.
 * This allows the system to be easily expanded with new visualization types (Graphs, Trees, Matrices, etc).
 */
export interface IVisualizer {
    /**
     * Unique identifier for this visualizer (e.g., 'train-array', 'matrix-2d')
     */
    readonly id: string;

    /**
     * Display name shown to the user (e.g., 'Train View', 'Matrix View')
     */
    readonly label: string;

    /**
     * Determines if this visualizer can handle the given variable.
     * @param variable The variable data to check
     */
    canHandle(variable: VariableData): boolean;

    /**
     * Generates the HTML structure for the visualization.
     * This HTML will be injected into the interactive canvas.
     * @param variable The variable data to render
     * @param instanceId A unique ID for this specific instance on the canvas
     */
    render(variable: VariableData, instanceId: string): string;

    /**
     * Returns the client-side JavaScript needed to make this visualization interactive.
     * This script will be executed when the visualization is added to the canvas.
     */
    getScript(instanceId: string): string;
}
