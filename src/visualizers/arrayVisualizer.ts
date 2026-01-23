import { IVisualizer } from './visualizer.interface';
import { VariableData } from '../debugProxy';
import { VisualizerWindow } from './visualizerWindow';

/**
 * The Array Visualizer.
 * Renders an array/vector as a linked series of carriages.
 */
export class ArrayVisualizer implements IVisualizer {
    readonly id = 'array-visualizer';
    readonly label = 'Array View';

    canHandle(variable: VariableData): boolean {
        if (!variable.type) return false;
        const type = variable.type.toLowerCase();
        return (
            type.includes('[') ||
            type.includes('std::vector') ||
            type.includes('std::array') ||
            type.includes('std::deque') ||
            type.includes('std::list')
        );
    }

    render(variable: VariableData, instanceId: string): string {
        const content = `
            <div class="train-container" data-var-ref="${variable.variablesReference}">
                ${this.renderCars(variable)}
            </div>
        `;
        
        // Use the standard window wrapper
        return VisualizerWindow.wrap(instanceId, variable.name, content);
    }

    getScript(instanceId: string): string {
        // TODO: Return JS to handle specific train interactions (like editing a car)
        return `console.log('Train visualizer initialized for ${instanceId}');`;
    }

    private renderCars(variable: VariableData): string {
        if (!variable.children) return '<div class="empty-train">Empty</div>';
        
        return variable.children.map((child, index) => `
            <div class="train-car">
                <div class="car-index">${index}</div>
                <input class="car-value" 
                       value="${child.value}" 
                       onchange="updateVariable('${variable.variablesReference}', '${child.name}', this.value)"
                />
            </div>
        `).join('');
    }
}
