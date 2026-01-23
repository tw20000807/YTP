import { IVisualizer } from './visualizer.interface';
import { VariableData } from '../debugProxy';
import { VisualizerWindow } from './visualizerWindow';

/**
 * The Primitive Visualizer.
 * Renders a simple box for basic types (int, float, bool, etc).
 */
export class PrimitiveVisualizer implements IVisualizer {
    readonly id = 'primitive-visualizer';
    readonly label = 'Value View';

    canHandle(variable: VariableData): boolean {
        // Handle everything that isn't an array/structure (or fallback)
        // For now, let's say it handles everything that doesn't have children, or simple types
        return !variable.children || variable.children.length === 0;
    }

    render(variable: VariableData, instanceId: string): string {
        const content = `
            <div class="primitive-container" style="padding: 10px; text-align: center;">
                <div style="font-size: 2em; color: #ce9178; margin-bottom: 10px;">
                    ${variable.value}
                </div>
                <input type="text" 
                       value="${variable.value}" 
                       style="width: 100%; background: #333; color: #ccc; border: 1px solid #555; padding: 4px;"
                       onchange="updateVariable('${variable.parent?.variablesReference}', '${variable.name}', this.value)"
                />
            </div>
        `;
        
        return VisualizerWindow.wrap(instanceId, variable.name, content);
    }

    getScript(instanceId: string): string {
        return '';
    }
}
