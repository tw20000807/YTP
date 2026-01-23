/**
 * A helper class to generate the "Window" container for visualizers.
 * This ensures all visualizers look consistent and have the same controls (drag, close).
 */
export class VisualizerWindow {
    /**
     * Wraps the visualizer content in a draggable window structure.
     */
    public static wrap(id: string, title: string, content: string): string {
        return `
            <div id="window-${id}" class="visualizer-window" style="left: 50px; top: 50px;">
                <div class="window-header" onmousedown="startDrag(event, 'window-${id}')">
                    <span class="window-title">Visualize: ${title}</span>
                    <div class="window-controls">
                        <button class="close-btn" onclick="closeWindow('window-${id}')">×</button>
                    </div>
                </div>
                <div class="window-content">
                    ${content}
                </div>
            </div>
        `;
    }
}
